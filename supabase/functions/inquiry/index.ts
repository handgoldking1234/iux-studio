// IUX Cloud — 문의 수신 함수
// 모든 고객사 홈페이지의 견적/이메일 문의를 받아 DB에 저장하고 담당자에게 메일을 보냅니다.
//
// 필요한 Secrets (Supabase > Edge Functions > Secrets)
//   RESEND_API_KEY : Resend API 키
//   MAIL_FROM      : 보내는 사람. 예) 'IUX.STUDIO <noreply@iux.studio>'
//   ADMIN_EMAILS   : (선택) 모든 문의를 참조로 받을 운영자 메일, 쉼표 구분
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어줍니다.

type Env = Record<string, string | undefined>;

const LIMIT = { perIp10m: 5 };
const MAX = { name: 50, company: 100, phone: 30, email: 120, subject: 200, message: 5000, ref: 300, chip: 40 };
const KIND_LABEL: Record<string, string> = { quote: '견적 문의', email: '이메일 문의', etc: '기타 문의' };

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

const json = (status: number, body: unknown, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) } });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function handle(req: Request, env: Env, fx: typeof fetch = fetch): Promise<Response> {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, origin);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json(400, { ok: false, error: 'invalid_json' }, origin); }

  // 스팸봇이 채우는 숨김 필드 — 성공한 척하고 버림
  if (str(b._gotcha, 100)) return json(200, { ok: true }, origin);

  const db = `${env.SUPABASE_URL}/rest/v1`;
  const key = env.SUPABASE_SERVICE_ROLE_KEY!;
  const dbh = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  // 사이트 확인
  const siteId = str(b.siteId, 40);
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(siteId)) return json(400, { ok: false, error: 'invalid_site' }, origin);
  const sr = await fx(`${db}/sites?id=eq.${siteId}&select=id,name,notify_emails,allowed_origins,active`, { headers: dbh });
  const site = (await sr.json())?.[0];
  if (!site || !site.active) return json(404, { ok: false, error: 'unknown_site' }, origin);
  if (site.allowed_origins?.length && !site.allowed_origins.includes(origin || '')) return json(403, { ok: false, error: 'origin_not_allowed' }, origin);

  // 입력값 정리 · 검증
  const kind = ['quote', 'email', 'etc'].includes(b.kind as string) ? (b.kind as string) : 'quote';
  const row = {
    site_id: siteId, kind,
    name: str(b.name, MAX.name), company: str(b.company, MAX.company), phone: str(b.phone, MAX.phone),
    email: str(b.email, MAX.email), subject: str(b.subject, MAX.subject), message: str(b.message, MAX.message),
    ref_url: str(b.ref, MAX.ref),
    types: (Array.isArray(b.types) ? b.types : []).slice(0, 20).map(t => str(t, MAX.chip)).filter(Boolean),
    budget: str(b.budget, MAX.chip), schedule: str(b.schedule, MAX.chip),
    extra: b.extra && typeof b.extra === 'object' && !Array.isArray(b.extra) ? Object.fromEntries(Object.entries(b.extra as object).slice(0, 20).map(([k, v]) => [str(k, 40), str(String(v), 1000)])) : {},
  };
  const errors: string[] = [];
  if (!row.name) errors.push('name');
  if (!isEmail(row.email)) errors.push('email');
  if (kind === 'quote' && !row.phone) errors.push('phone');
  if (kind === 'email' && !row.subject) errors.push('subject');
  if (errors.length) return json(400, { ok: false, error: 'invalid_fields', fields: errors }, origin);

  // 같은 IP 도배 방지 (IP는 해시로만 저장)
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '';
  const ip_hash = ip ? (await sha256(ip + '|' + key.slice(-16))).slice(0, 32) : null;
  if (ip_hash) {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const cr = await fx(`${db}/inquiries?select=id&ip_hash=eq.${ip_hash}&created_at=gte.${encodeURIComponent(since)}`, { headers: { ...dbh, Prefer: 'count=exact', Range: '0-0' } });
    const total = Number((cr.headers.get('content-range') || '*/0').split('/')[1]);
    if (total >= LIMIT.perIp10m) return json(429, { ok: false, error: 'too_many_requests' }, origin);
  }

  // 저장
  const ir = await fx(`${db}/inquiries`, {
    method: 'POST', headers: { ...dbh, Prefer: 'return=representation' },
    body: JSON.stringify({ ...row, origin, ip_hash, user_agent: str(req.headers.get('user-agent'), 300) }),
  });
  if (!ir.ok) { console.error('insert failed', ir.status, await ir.text()); return json(500, { ok: false, error: 'save_failed' }, origin); }
  const saved = (await ir.json())[0];

  // 알림 메일
  const to: string[] = site.notify_emails || [];
  const cc = (env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(s => s && !to.includes(s));
  let notified = false;
  if (env.RESEND_API_KEY && env.MAIL_FROM && (to.length || cc.length)) {
    const label = KIND_LABEL[kind];
    const subject = `[${site.name} ${label}] ${row.subject || row.company || row.name}`;
    const rows: [string, string][] = [
      ['구분', label], ['담당자명', row.name], ['회사명', row.company], ['연락처', row.phone], ['이메일', row.email],
      ['제목', row.subject], ['문의 유형', row.types.join(', ')], ['예상 예산', row.budget], ['희망 오픈 시기', row.schedule],
      ['참고 사이트', row.ref_url], ...Object.entries(row.extra).map(([k, v]) => [k, String(v)] as [string, string]),
    ];
    const html = `<div style="font-family:Apple SD Gothic Neo,Malgun Gothic,sans-serif;max-width:640px">
      <h2 style="margin:0 0 16px;font-size:20px">${esc(site.name)} · 새 ${label}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows.filter(r => r[1]).map(([k, v]) =>
        `<tr><th style="text-align:left;width:120px;padding:8px;border-bottom:1px solid #eee;color:#666;font-weight:600">${esc(k)}</th><td style="padding:8px;border-bottom:1px solid #eee">${esc(v)}</td></tr>`).join('')}</table>
      ${row.message ? `<p style="margin:20px 0 6px;color:#666;font-size:13px;font-weight:600">문의 내용</p><div style="white-space:pre-wrap;font-size:14px;line-height:1.6;padding:14px;background:#f6f7f9;border-radius:6px">${esc(row.message)}</div>` : ''}
      <p style="margin-top:24px;font-size:12px;color:#999">이 메일에 답장하면 문의자(${esc(row.email)})에게 전달됩니다.</p></div>`;
    try {
      const mr = await fx('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, to: to.length ? to : cc, cc: to.length && cc.length ? cc : undefined, reply_to: row.email, subject, html }),
      });
      notified = mr.ok;
      if (!mr.ok) console.error('mail failed', mr.status, await mr.text());
    } catch (e) { console.error('mail error', e); }
    if (notified) await fx(`${db}/inquiries?id=eq.${saved.id}`, { method: 'PATCH', headers: dbh, body: JSON.stringify({ notified: true }) });
  }

  return json(200, { ok: true, id: saved.id, notified }, origin);
}

// Supabase Edge Runtime(Deno) 진입점
// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D) D.serve((req: Request) => handle(req, D.env.toObject()));
