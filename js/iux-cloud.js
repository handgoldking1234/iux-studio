/* =========================================================
   IUX Cloud 클라이언트 — 모든 고객사 홈페이지에 공통으로 넣는 스크립트
   사용법:
     <script src="https://handgoldking1234.github.io/iux-studio/js/iux-cloud.js"></script>
     IUXCloud.init({ url: 'https://xxxx.supabase.co', anonKey: 'eyJ...', siteId: 'clinic-abc' });
     await IUXCloud.sendInquiry({ kind: 'quote', name, phone, email, message, ... });
     const { items, total } = await IUXCloud.listPosts('notice', { page: 1, size: 10 });
     const post = await IUXCloud.getPost(id);
     el.innerHTML = IUXCloud.md(post.body);
   ========================================================= */
(function (g) {
  'use strict';
  const cfg = { url: '', anonKey: '', siteId: '' };
  const ready = () => !!(cfg.url && cfg.anonKey && cfg.siteId);
  const rest = (path, opt = {}) => fetch(`${cfg.url}/rest/v1/${path}`, {
    ...opt, headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json', ...(opt.headers || {}) }
  });
  const enc = encodeURIComponent;

  const ERR = {
    invalid_fields: '필수 항목을 확인해 주세요.',
    too_many_requests: '잠시 후 다시 시도해 주세요. (짧은 시간에 너무 많은 문의가 접수되었습니다)',
    origin_not_allowed: '허용되지 않은 사이트에서 보낸 문의입니다.',
    unknown_site: '사이트 설정을 확인해 주세요.'
  };

  async function sendInquiry(data) {
    if (!ready()) throw new Error('IUXCloud.init() 설정이 필요합니다.');
    const r = await fetch(`${cfg.url}/functions/v1/inquiry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: cfg.siteId, ...data })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { const e = new Error(ERR[j.error] || '전송에 실패했습니다.'); e.code = j.error; e.fields = j.fields; throw e; }
    return j;
  }

  async function listPosts(board, { page = 1, size = 10, q = '' } = {}) {
    const from = (page - 1) * size;
    let p = `posts?select=id,title,cover_url,pinned,views,created_at,body&site_id=eq.${enc(cfg.siteId)}&board=eq.${enc(board)}&published=is.true&order=pinned.desc,created_at.desc`;
    if (q) p += `&title=ilike.${enc('*' + q.replace(/[*,()]/g, ' ') + '*')}`;
    const r = await rest(p, { headers: { Prefer: 'count=exact', Range: `${from}-${from + size - 1}` } });
    if (!r.ok && r.status !== 416) throw new Error('목록을 불러오지 못했습니다.');
    const items = r.status === 416 ? [] : await r.json();
    const total = Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0;
    return { items: items.map(x => ({ ...x, excerpt: excerpt(x.body), body: undefined })), total, page, size, pages: Math.max(1, Math.ceil(total / size)) };
  }

  async function getPost(id) {
    const r = await rest(`posts?select=*&id=eq.${enc(id)}&site_id=eq.${enc(cfg.siteId)}&published=is.true`);
    const post = r.ok ? (await r.json())[0] : null;
    if (post) rest('rpc/increment_post_view', { method: 'POST', body: JSON.stringify({ p: id }) }).catch(() => {});
    return post || null;
  }

  async function getBoard(slug) {
    const r = await rest(`boards?select=slug,name,kind&site_id=eq.${enc(cfg.siteId)}&slug=eq.${enc(slug)}`);
    return r.ok ? (await r.json())[0] || null : null;
  }

  /* ---------- 간단한 마크다운 (제목, 굵게, 기울임, 링크, 이미지, 목록, 인용, 구분선, 코드) ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => /^(https?:\/\/|\/|\.\/|#|mailto:|tel:)/i.test(u) ? u : '#';
  const inline = s => esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${safeUrl(u)}" alt="${a}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${safeUrl(u)}"${/^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  function md(src) {
    const lines = String(src || '').replace(/\r/g, '').split('\n'), out = [];
    let list = null, para = [];
    const flush = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; } };
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const ln of lines) {
      let m;
      if (!ln.trim()) { flush(); close(); continue; }
      if ((m = ln.match(/^(#{1,3})\s+(.*)$/))) { flush(); close(); out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); continue; }
      if (/^(-{3,}|\*{3,})$/.test(ln.trim())) { flush(); close(); out.push('<hr>'); continue; }
      if ((m = ln.match(/^>\s?(.*)$/))) { flush(); close(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
      if ((m = ln.match(/^\s*[-*]\s+(.*)$/)) || (m = ln.match(/^\s*\d+[.)]\s+(.*)$/))) {
        flush(); const t = /^\s*\d/.test(ln) ? 'ol' : 'ul';
        if (list !== t) { close(); out.push(`<${t}>`); list = t; }
        out.push(`<li>${inline(m[1])}</li>`); continue;
      }
      close(); para.push(ln);
    }
    flush(); close();
    return out.join('');
  }
  const excerpt = (s, n = 120) => String(s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*`_-]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

  g.IUXCloud = {
    init(o) { Object.assign(cfg, o || {}); return this; },
    get ready() { return ready(); },
    get siteId() { return cfg.siteId; },
    sendInquiry, listPosts, getPost, getBoard, md, excerpt, esc
  };
})(window);
