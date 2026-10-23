// IUX Cloud — 게시판 함수 (방문자 글쓰기 · 수정 · 삭제 · 댓글 · 첨부파일)
// 로봇 방지: Cloudflare Turnstile
//
// 필요한 Secrets (Supabase > Edge Functions > Secrets)
//   TURNSTILE_SECRET : Cloudflare Turnstile 비밀 키
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 자동으로 들어갑니다.

type Env = Record<string, string | undefined>;
type J = Record<string, unknown>;

const EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'hwpx', 'zip', 'txt'];
const MAX_FILES = 5, MAX_SIZE = 10 * 1024 * 1024, LIMIT_10M = 6;
const ERR: Record<string, string> = {
  write_not_allowed: '이 게시판은 글쓰기를 받지 않습니다.', comment_not_allowed: '이 게시판은 댓글을 받지 않습니다.',
  invalid_category: '분류를 다시 선택해 주세요.', invalid_fields: '필수 항목을 확인해 주세요. (비밀번호 4자 이상)',
  invalid_parent: '답글을 달 수 없는 댓글입니다.', not_found: '글을 찾을 수 없습니다.', wrong_password: '비밀번호가 맞지 않습니다.',
  captcha_failed: '로봇 확인에 실패했습니다. 다시 시도해 주세요.', turnstile_not_configured: '로봇 방지 설정이 아직 되지 않았습니다. 관리자에게 문의해 주세요.',
  too_many_requests: '잠시 후 다시 시도해 주세요.', expired: '시간이 지났습니다. 다시 시도해 주세요.', origin_not_allowed: '허용되지 않은 사이트입니다.', unknown_site: '사이트 설정을 확인해 주세요.'
};

const cors = (o: string | null) => ({ 'Access-Control-Allow-Origin': o || '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info', Vary: 'Origin' });
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isUuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
const enc = new TextEncoder();
async function hex(buf: ArrayBuffer) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function hmac(key: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}

export async function handle(req: Request, env: Env, fx: typeof fetch = fetch): Promise<Response> {
  const origin = req.headers.get('origin');
  const out = (status: number, body: J) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin) } });
  const fail = (status: number, code: string) => out(status, { ok: false, error: code, message: ERR[code] || code });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  let b: J; try { b = await req.json(); } catch { return fail(400, 'invalid_json'); }
  if (str(b._gotcha, 100)) return out(200, { ok: true });

  const URL_ = env.SUPABASE_URL!, KEY = env.SUPABASE_SERVICE_ROLE_KEY!;
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  const rpc = async (fn: string, args: J) => {
    const r = await fx(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) });
    const t = await r.text(); let j: unknown = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
    if (!r.ok) { const m = (j as J)?.message as string || String(r.status); const e = new Error(m); (e as Error & { code?: string }).code = Object.keys(ERR).find(k => m.includes(k)) || 'server_error'; throw e; }
    return j;
  };
  const get = async (path: string) => { const r = await fx(`${URL_}/rest/v1/${path}`, { headers: H }); return r.ok ? r.json() : []; };

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '';
  const ipHash = ip ? (await hmac(KEY.slice(-24), 'ip|' + ip)).slice(0, 32) : '';
  const ticket = async (id: string, exp = Date.now() + 30 * 60 * 1000) => `${exp}.${await hmac(KEY, `ticket|${id}|${exp}`)}`;
  const okTicket = async (id: string, t: unknown) => { const [exp, sig] = String(t || '').split('.'); return +exp > Date.now() && sig === (await hmac(KEY, `ticket|${id}|${exp}`)); };

  // 사이트 · 출처 확인
  const siteCheck = async (siteId: string) => {
    const s = (await get(`sites?id=eq.${encodeURIComponent(siteId)}&select=id,active,allowed_origins`))[0];
    if (!s || !s.active) return 'unknown_site';
    if (s.allowed_origins?.length && !s.allowed_origins.includes(origin || '')) return 'origin_not_allowed';
    return '';
  };
  const postOf = async (id: string) => (await get(`posts?id=eq.${id}&select=id,site_id,board,is_admin,attachments`))[0];
  const human = async () => {
    if (!env.TURNSTILE_SECRET) return 'turnstile_not_configured';
    const f = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: str(b.token, 2048) }); if (ip) f.set('remoteip', ip);
    const r = await fx('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: f });
    const j = await r.json().catch(() => ({}));
    return j.success ? '' : 'captcha_failed';
  };
  const flood = async () => ipHash && (await rpc('board_recent', { ip: ipHash }) as number) >= LIMIT_10M;
  const uploads = async (site: string, id: string, files: unknown) => {
    const list = Array.isArray(files) ? files.slice(0, MAX_FILES) : [];
    const res = [];
    for (const f of list as J[]) {
      const name = str(f.name, 120) || 'file', ext = (name.split('.').pop() || '').toLowerCase(), size = Number(f.size) || 0;
      if (!EXT.includes(ext)) throw Object.assign(new Error(`허용되지 않는 파일 형식입니다: ${name}`), { code: 'bad_file' });
      if (size > MAX_SIZE) throw Object.assign(new Error(`10MB 이하 파일만 올릴 수 있습니다: ${name}`), { code: 'bad_file' });
      const path = `${site}/board/${id}/${crypto.randomUUID()}.${ext}`;
      const r = await fx(`${URL_}/storage/v1/object/upload/sign/files/${path}`, { method: 'POST', headers: H, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw Object.assign(new Error('업로드 주소를 만들지 못했습니다.'), { code: 'upload_failed' });
      res.push({ name, size, path, url: `${URL_}/storage/v1${j.url}` });
    }
    return res;
  };
  const publicUrl = (path: string) => `${URL_}/storage/v1/object/public/files/${path}`;

  try {
    const action = str(b.action, 30);

    if (action === 'create_post' || action === 'create_comment') {
      const site = action === 'create_post' ? str(b.site, 40) : (await postOf(isUuid(b.post) ? b.post as string : '00000000-0000-0000-0000-000000000000'))?.site_id;
      if (!site) return fail(404, 'not_found');
      const sc = await siteCheck(site); if (sc) return fail(403, sc);
      const h = await human(); if (h) return fail(h === 'captcha_failed' ? 400 : 503, h);
      if (await flood()) return fail(429, 'too_many_requests');
      if (action === 'create_comment') {
        const id = await rpc('board_create_comment', { p: { post: b.post, parent: isUuid(b.parent) ? b.parent : null, name: str(b.name, 30), body: str(b.body, 3000), pw: str(b.pw, 64), ip: ipHash } });
        return out(200, { ok: true, id });
      }
      const id = await rpc('board_create_post', { p: { site, board: str(b.board, 40), title: str(b.title, 200), body: str(b.body, 20000), category: str(b.category, 40), name: str(b.name, 30), pw: str(b.pw, 64), ip: ipHash } }) as string;
      let up: unknown[] = [];
      try { up = await uploads(site, id, b.files); } catch (e) { await rpc('board_delete_post', { pid: id }); throw e; }
      return out(200, { ok: true, id, uploads: up, ticket: await ticket(id) });
    }

    if (action === 'check_post' || action === 'delete_post') {
      if (!isUuid(b.id)) return fail(400, 'invalid_fields');
      const po = await postOf(b.id as string); if (!po || po.is_admin) return fail(404, 'not_found');
      const h = await human(); if (h) return fail(h === 'captcha_failed' ? 400 : 503, h);   // 비밀번호 대입 방지
      const ok = await rpc('board_check_post', { pid: b.id, pw: str(b.pw, 64) });
      if (!ok) return fail(403, 'wrong_password');
      if (action === 'delete_post') {
        const paths = (po.attachments || []).map((a: J) => a.path).filter(Boolean);
        if (paths.length) await fx(`${URL_}/storage/v1/object/files`, { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: paths }) }).catch(() => {});
        await rpc('board_delete_post', { pid: b.id });
        return out(200, { ok: true });
      }
      return out(200, { ok: true, ticket: await ticket(b.id as string) });
    }

    if (action === 'update_post') {
      if (!isUuid(b.id) || !(await okTicket(b.id as string, b.ticket))) return fail(403, 'expired');
      const po = await postOf(b.id as string); if (!po) return fail(404, 'not_found');
      await rpc('board_update_post', { pid: b.id, p: { title: str(b.title, 200), body: str(b.body, 20000), category: str(b.category, 40), name: str(b.name, 30) } });
      const keep = (Array.isArray(b.keep) ? b.keep : []) as string[];
      const kept = (po.attachments || []).filter((a: J) => keep.includes(a.path as string));
      const removed = (po.attachments || []).filter((a: J) => !keep.includes(a.path as string)).map((a: J) => a.path);
      if (removed.length) await fx(`${URL_}/storage/v1/object/files`, { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: removed }) }).catch(() => {});
      await rpc('board_set_attachments', { pid: b.id, atts: kept });
      const up = await uploads(po.site_id, b.id as string, (b.files as unknown[] || []).slice(0, Math.max(0, MAX_FILES - kept.length)));
      return out(200, { ok: true, id: b.id, uploads: up, ticket: await ticket(b.id as string) });
    }

    if (action === 'attach') {
      if (!isUuid(b.id) || !(await okTicket(b.id as string, b.ticket))) return fail(403, 'expired');
      const po = await postOf(b.id as string); if (!po) return fail(404, 'not_found');
      const pre = `${po.site_id}/board/${b.id}/`;
      const add = ((Array.isArray(b.files) ? b.files : []) as J[]).filter(f => typeof f.path === 'string' && (f.path as string).startsWith(pre) && !(f.path as string).includes('..'))
        .map(f => ({ name: str(f.name, 120), size: Number(f.size) || 0, type: str(f.type, 100), path: f.path, url: publicUrl(f.path as string) }));
      const all = [...(po.attachments || []), ...add].slice(0, MAX_FILES);
      await rpc('board_set_attachments', { pid: b.id, atts: all });
      return out(200, { ok: true, attachments: all });
    }

    if (action === 'delete_comment') {
      if (!isUuid(b.id)) return fail(400, 'invalid_fields');
      const h = await human(); if (h) return fail(h === 'captcha_failed' ? 400 : 503, h);
      const ok = await rpc('board_delete_comment', { cid: b.id, pw: str(b.pw, 64) });
      return ok ? out(200, { ok: true }) : fail(403, 'wrong_password');
    }

    return fail(400, 'unknown_action');
  } catch (e) {
    const code = (e as Error & { code?: string }).code || 'server_error';
    console.error(action_(b), e);
    return out(code === 'server_error' ? 500 : 400, { ok: false, error: code, message: ERR[code] || (e as Error).message });
  }
}
const action_ = (b: J) => String(b?.action || '');

// Supabase Edge Runtime(Deno) 진입점
// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D) D.serve((req: Request) => handle(req, D.env.toObject()));
