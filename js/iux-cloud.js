/* =========================================================
   IUX Cloud 클라이언트 — 모든 고객사 홈페이지에 공통으로 넣는 스크립트
   사용법:
     <script src="https://iux-studio.vercel.app/js/iux-cloud.js"></script>
     IUXCloud.init({ url: 'https://xxxx.supabase.co', anonKey: 'eyJ...', siteId: 'clinic-abc' });
     await IUXCloud.sendInquiry({ kind: 'quote', name, phone, email, message, ... });
     const { items, total } = await IUXCloud.listPosts('notice', { page: 1, size: 10 });
     const post = await IUXCloud.getPost(id);
     el.innerHTML = IUXCloud.md(post.body);
     const site = await IUXCloud.getSite();   // 관리자 '콘텐츠 관리'에서 저장한 내용
   방문 통계는 init() 하면 자동으로 기록됩니다. (끄려면 init({ ..., track: false }))
   ========================================================= */
(function (g) {
  'use strict';
  const cfg = { url: '', anonKey: '', siteId: '', track: true };
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

  /* ---------- 방문 기록 (쿠키 · 개인정보 없이 세션 단위) ---------- */
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (_) {} } };
  const SEARCH = { naver: /(^|\.)search\.naver\.com$|^m\.search\.naver\.com$/, google: /(^|\.)google\./, daum: /(^|\.)search\.daum\.net$|^m\.search\.daum\.net$/, bing: /(^|\.)bing\.com$/ };
  const SOCIAL = { instagram: /instagram\.com$/, facebook: /(facebook|fb)\.com$/, kakao: /kakao\.com$|kakao\.co\.kr$/, youtube: /youtube\.com$|youtu\.be$/, blog: /blog\.naver\.com$|tistory\.com$|brunch\.co\.kr$|velog\.io$/ };
  function session() {
    let sid = ss.get('iuxc-sid'), src = ss.get('iuxc-src'), last = +ss.get('iuxc-t') || 0;
    if (!sid || Date.now() - last > 30 * 60 * 1000) {
      sid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
      const q = new URLSearchParams(location.search), utm = (q.get('utm_source') || '').toLowerCase();
      let host = ''; try { host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (_) {}
      if (host === location.hostname) host = '';
      src = utm ? (Object.keys({ ...SEARCH, ...SOCIAL }).find(k => utm.includes(k)) || 'other')
        : !host ? 'direct' : (Object.keys(SEARCH).find(k => SEARCH[k].test(host)) || Object.keys(SOCIAL).find(k => SOCIAL[k].test(host)) || 'other');
      ss.set('iuxc-sid', sid); ss.set('iuxc-src', src); ss.set('iuxc-ref', host); ss.set('iuxc-kw', q.get('utm_term') || q.get('keyword') || '');
    }
    ss.set('iuxc-t', Date.now());
    return { sid, src, ref: ss.get('iuxc-ref') || '', kw: ss.get('iuxc-kw') || '' };
  }
  function env() {
    const ua = navigator.userAgent, w = Math.min(screen.width, screen.height), touch = navigator.maxTouchPoints > 1;
    const device = /iPad|Tablet/i.test(ua) || (touch && /Macintosh/.test(ua)) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : 'pc';
    const os = /iPhone|iPad|iPod/.test(ua) || (touch && /Macintosh/.test(ua)) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '기타';
    const browser = /NAVER/.test(ua) ? '네이버 앱' : /KAKAOTALK/.test(ua) ? '카카오톡' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Edg\//.test(ua) ? 'Edge' : /Whale/.test(ua) ? 'Whale' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : '기타';
    return { device, os, browser, screen: `${screen.width}x${screen.height}` };
  }
  let pv = null, pvStart = 0, hiddenMs = 0, hiddenAt = 0;
  async function track(path) {
    if (!ready() || !cfg.track || navigator.webdriver) return;
    const s = session();
    flush();
    pvStart = Date.now(); hiddenMs = 0; hiddenAt = 0;
    try {
      const r = await rest('rpc/track', { method: 'POST', body: JSON.stringify({ p: { site: cfg.siteId, sid: s.sid, path: path || new URLSearchParams(location.search).get('p') || location.pathname.replace(/\/index\.html$/, '/').replace(/^\/[^/]+(?=\/)/, m => location.hostname.endsWith('github.io') ? '' : m), title: document.title.slice(0, 200), ref: s.ref, source: s.src, kw: s.kw, ...env() } }) });
      pv = r.ok ? { id: await r.json(), sid: s.sid } : null;
    } catch (_) { pv = null; }
  }
  function flush() {
    if (!pv || !pv.id) return;
    const ms = Date.now() - pvStart - hiddenMs - (hiddenAt ? Date.now() - hiddenAt : 0);
    rest('rpc/track_time', { method: 'POST', keepalive: true, body: JSON.stringify({ p_id: pv.id, p_sid: pv.sid, p_ms: Math.round(ms) }) }).catch(() => {});
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); flush(); }
    else if (hiddenAt) { hiddenMs += Date.now() - hiddenAt; hiddenAt = 0; }
  });
  addEventListener('pagehide', flush);

  /* ---------- 관리자에서 저장한 콘텐츠 ---------- */
  let sitePromise = null;
  function getSite() {
    if (!ready()) return Promise.resolve(null);
    return sitePromise || (sitePromise = rest('rpc/site_public', { method: 'POST', body: JSON.stringify({ s: cfg.siteId }) })
      .then(r => r.ok ? r.json() : null).catch(() => null));
  }

  async function sendInquiry(data) {
    if (!ready()) throw new Error('IUXCloud.init() 설정이 필요합니다.');
    const s = session();
    const r = await fetch(`${cfg.url}/functions/v1/inquiry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: cfg.siteId, source: s.src, sid: s.sid, ...data })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { const e = new Error(ERR[j.error] || '전송에 실패했습니다.'); e.code = j.error; e.fields = j.fields; throw e; }
    return j;
  }

  const POST_COLS = 'id,title,cover_url,pinned,views,created_at,updated_at,body,category,author_name,is_admin,attachments,comment_count,board';
  async function listPosts(board, { page = 1, size = 10, q = '', full = false, oldestFirst = false, category = '' } = {}) {
    const from = (page - 1) * size;
    let p = `posts?select=${POST_COLS}&site_id=eq.${enc(cfg.siteId)}&board=eq.${enc(board)}&published=is.true&order=pinned.desc,created_at.${oldestFirst ? 'asc' : 'desc'}`;
    if (category) p += `&category=eq.${enc(category)}`;
    if (q) p += `&title=ilike.${enc('*' + q.replace(/[*,()]/g, ' ') + '*')}`;
    const r = await rest(p, { headers: { Prefer: 'count=exact', Range: `${from}-${from + size - 1}` } });
    if (!r.ok && r.status !== 416) throw new Error('목록을 불러오지 못했습니다.');
    const items = r.status === 416 ? [] : await r.json();
    const total = Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0;
    return { items: items.map(x => ({ ...x, excerpt: excerpt(x.body), body: full ? x.body : undefined })), total, page, size, pages: Math.max(1, Math.ceil(total / size)) };
  }

  async function getPost(id) {
    const r = await rest(`posts?select=${POST_COLS}&id=eq.${enc(id)}&site_id=eq.${enc(cfg.siteId)}&published=is.true`);
    const post = r.ok ? (await r.json())[0] : null;
    if (post) rest('rpc/increment_post_view', { method: 'POST', body: JSON.stringify({ p: id }) }).catch(() => {});
    return post || null;
  }

  /* ---------- 일반 게시판: 방문자 글쓰기 · 댓글 (로봇 방지 Turnstile) ---------- */
  async function boardCall(action, data) {
    const r = await fetch(`${cfg.url}/functions/v1/board`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, site: cfg.siteId, ...data }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { const e = new Error(j.message || '처리하지 못했습니다.'); e.code = j.error; throw e; }
    return j;
  }
  const meta = f => ({ name: f.name, size: f.size, type: f.type });
  async function putFiles(res, files) {
    const done = [];
    for (let i = 0; i < (res.uploads || []).length; i++) {
      const u = res.uploads[i], f = files[i];
      const type = /^(image\/(jpeg|png|gif|webp)|application\/pdf|text\/plain|application\/zip)$/.test(f.type) ? f.type : 'application/octet-stream';
      const r = await fetch(u.url, { method: 'PUT', headers: { 'Content-Type': type, 'x-upsert': 'false' }, body: f });
      if (r.ok) done.push({ path: u.path, name: u.name, size: u.size, type });
    }
    if (done.length) await boardCall('attach', { id: res.id, ticket: res.ticket, files: done });
    return done.length;
  }
  async function createPost(d) {
    const files = [...(d.files || [])];
    const res = await boardCall('create_post', { board: d.board, title: d.title, body: d.body, category: d.category, name: d.name, pw: d.pw, token: d.token, files: files.map(meta) });
    await putFiles(res, files); return res.id;
  }
  const checkPost = (id, pw, token) => boardCall('check_post', { id, pw, token }).then(j => j.ticket);
  async function updatePost(id, ticket, d) {
    const files = [...(d.files || [])];
    const res = await boardCall('update_post', { id, ticket, title: d.title, body: d.body, category: d.category, name: d.name, keep: d.keep || [], files: files.map(meta) });
    await putFiles(res, files); return id;
  }
  const deletePost = (id, pw, token) => boardCall('delete_post', { id, pw, token });
  const createComment = d => boardCall('create_comment', d);
  const deleteComment = (id, pw, token) => boardCall('delete_comment', { id, pw, token });
  async function getComments(postId) {
    const r = await rest(`comments?select=id,parent_id,author_name,body,is_admin,created_at&post_id=eq.${enc(postId)}&hidden=is.false&order=created_at.asc`);
    return r.ok ? r.json() : [];
  }
  /* Turnstile 위젯: const c = await IUXCloud.captcha(el); c.token(); c.reset(); */
  let tsLoad = null;
  async function captcha(el) {
    const site = await getSite(), key = site && site.turnstile;
    if (!key) { el.innerHTML = '<p style="font-size:13px;color:#f3727f">로봇 방지 설정이 아직 되지 않았습니다.</p>'; return { token: () => '', reset() {} }; }
    tsLoad = tsLoad || new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
    await tsLoad;
    let tok = '';
    const wid = g.turnstile.render(el, { sitekey: key, theme: 'dark', language: 'ko', callback: t => { tok = t; }, 'expired-callback': () => { tok = ''; } });
    return { token: () => tok, reset: () => { tok = ''; g.turnstile.reset(wid); } };
  }

  async function getBoard(slug) {
    const r = await rest(`boards?select=slug,name,kind,categories,allow_write,allow_comment,show_menu&site_id=eq.${enc(cfg.siteId)}&slug=eq.${enc(slug)}`);
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
    init(o) {
      Object.assign(cfg, o || {});
      if (cfg.track && !this._tracked) { this._tracked = true; document.readyState === 'loading' ? addEventListener('DOMContentLoaded', () => track()) : track(); }
      return this;
    },
    track, getSite,
    get ready() { return ready(); },
    get siteId() { return cfg.siteId; },
    sendInquiry, listPosts, getPost, getBoard, md, excerpt, esc,
    createPost, checkPost, updatePost, deletePost, createComment, deleteComment, getComments, captcha
  };
})(window);
