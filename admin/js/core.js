/* IUX.studio 관리자 — 공통 (로그인 · 레이아웃 · 라우팅 · 도우미) */
(() => {
  'use strict';
  const A = window.A = { views: {} };
  const CFG = A.cfg = window.ADMIN_CONFIG || {};

  /* ---------- 도우미 ---------- */
  const $ = A.$ = (s, r = document) => r.querySelector(s);
  const $$ = A.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = A.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.n = v => (Number(v) || 0).toLocaleString('ko-KR');
  A.pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
  const pad = v => String(v).padStart(2, '0');
  A.ymd = d => { const t = new Date(d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
  A.dot = d => d ? A.ymd(d).replace(/-/g, '.') : '-';
  A.md_ = d => { const t = new Date(d); return `${t.getMonth() + 1}.${pad(t.getDate())}`; };
  A.dtime = d => { const t = new Date(d); return `${A.dot(d)} ${pad(t.getHours())}:${pad(t.getMinutes())}`; };
  A.dur = ms => { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}분 ${pad(s % 60)}초`; };
  A.dday = d => {
    if (!d) return { n: Infinity, t: '', c: '' };
    const n = Math.ceil((new Date(d + 'T00:00:00') - new Date(A.ymd(new Date()) + 'T00:00:00')) / 864e5);
    return { n, t: n < 0 ? `만료 ${-n}일` : `D-${n}`, c: n <= 14 ? 'is-neg' : n <= 30 ? 'is-warn' : '' };
  };
  A.clone = o => JSON.parse(JSON.stringify(o ?? null));
  A.initial = s => (String(s || '?').trim()[0] || '?').toUpperCase();
  const store = A.store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

  /* 아이콘 (시안과 같은 선 아이콘) */
  const P = A.paths = {
    overview: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    build: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 8v8M8 12h8',
    hosting: 'M4 2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM6 6h.01M6 18h.01',
    dash: 'M3 3v18h18M18 17V9M13 17V5M8 17v-3',
    traffic: 'M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M21 21l-4.3-4.3',
    device: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 18h.01',
    exit: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    content: 'M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5zM15 5l4 4',
    inq: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    service: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4',
    seo: 'M3 3v18h18M7 14l4-4 4 4 5-5M15 9h5v5',
    board: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
    settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    menu: 'M4 6h16M4 12h16M4 18h16', search: 'M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M21 21l-4.3-4.3',
    bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9', plus: 'M12 5v14M5 12h14', x: 'M18 6 6 18M6 6l12 12',
    chev: 'm6 9 6 6 6-6', updown: 'm7 15 5 5 5-5M7 9l5-5 5 5', moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
    sun: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    me: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8', key: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
    team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    help: 'M12 22a10 10 0 1 0 0-20a10 10 0 1 0 0 20M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
    globe: 'M12 22a10 10 0 1 0 0-20a10 10 0 1 0 0 20M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20',
    wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7ZM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6', clock: 'M12 22a10 10 0 1 0 0-20a10 10 0 1 0 0 20M12 6v6l4 2',
    cal: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18', shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    card: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20', image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 9h.01M21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21',
    up: 'M12 19V5M5 12l7-7 7 7', ext: 'M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'
  };
  const I = A.I = (k, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24"><path d="${P[k] || k}"/></svg>`;

  /* ---------- 상수 ---------- */
  A.STAGE = { build: '제작중', review: '검수중', live: '운영중' };
  A.CATS = ['기업', '브랜드', '병원', '쇼핑몰', '랜딩', '기타'];
  A.TINTS = ['#1d4a3a', '#1e3a5f', '#5a2a1c', '#3a2560', '#4a3a12', '#123c4a', '#4a1d34'];
  A.INQ = { new: '신규', progress: '상담중', quote: '견적 발송', contract: '계약', hold: '보류', done: '완료', spam: '스팸' };
  A.KIND = { quote: '견적 문의', email: '이메일 문의', etc: '기타 문의' };
  A.SRC = { naver: '네이버 검색', google: '구글 검색', daum: '다음 검색', bing: 'Bing 검색', direct: '직접 방문', instagram: '인스타그램', facebook: '페이스북', kakao: '카카오', youtube: '유튜브', blog: '블로그', other: '기타 추천', admin: '관리자 요청' };
  A.DEV = { mobile: '모바일', pc: 'PC', tablet: '태블릿' };
  const TABS = A.TABS = [['dash', '대시보드'], ['traffic', '유입 · 검색어'], ['device', '기기 · OS'], ['exit', '이탈 분석'], ['content', '콘텐츠 관리'], ['seo', 'SEO 관리'], ['inq', '문의 관리'], ['board', '게시판']];

  /* ---------- 공통 UI ---------- */
  const layer = () => $('#layer');
  let toastT;
  A.toast = (m, err) => {
    $('.toast')?.remove(); clearTimeout(toastT);
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' is-err' : ''); t.setAttribute('role', 'status'); t.textContent = m;
    document.body.appendChild(t); toastT = setTimeout(() => t.remove(), 2600);
  };
  A.fail = (e, m = '처리하지 못했습니다.') => { console.error(e); const msg = e?.message || ''; A.toast(/forbidden|permission/i.test(msg) ? '권한이 없습니다.' : `${m}${msg ? ' (' + msg + ')' : ''}`, true); };
  A.modal = ({ title, body, foot, wide, onOpen }) => {
    const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = `<div class="modal__dim" data-x></div><div class="modal__box${wide ? ' modal__box--wide' : ''}">
      <div class="modal__h"><h2>${esc(title)}</h2><button class="xbtn" data-x aria-label="닫기">${I('x', 'i--sm')}</button></div>
      <div class="modal__b">${body}</div>${foot ? `<div class="modal__f">${foot}</div>` : ''}</div>`;
    const close = () => { m.remove(); if (!$('.modal,.drawer', layer())) document.body.classList.remove('lock'); };
    m.addEventListener('click', e => { if (e.target.closest('[data-x]')) close(); });
    m.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    layer().appendChild(m); document.body.classList.add('lock');
    onOpen?.(m, close); setTimeout(() => m.querySelector('input,textarea,select')?.focus(), 30);
    return { el: m, close };
  };
  A.drawer = ({ title, body, onOpen }) => {
    const d = document.createElement('div'); d.className = 'drawer';
    d.innerHTML = `<div class="drawer__dim" data-x></div><aside class="drawer__box" role="dialog" aria-modal="true"><div class="drawer__h"><h2>${esc(title)}</h2><button class="xbtn" data-x aria-label="닫기">${I('x', 'i--sm')}</button></div><div class="drawer__b">${body}</div></aside>`;
    const close = () => { d.remove(); if (!$('.modal,.drawer', layer())) document.body.classList.remove('lock'); };
    d.addEventListener('click', e => { if (e.target.closest('[data-x]')) close(); });
    layer().appendChild(d); document.body.classList.add('lock'); onOpen?.(d, close);
    return { el: d, close };
  };
  addEventListener('keydown', e => { if (e.key === 'Escape') { const top = [...layer().children].pop(); top?.querySelector('[data-x]')?.click(); } });
  A.confirm = (msg) => window.confirm(msg);

  /* 이미지 업로드 (긴 변 2000px 로 줄여서 저장) */
  async function shrink(file, max = 2000) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
    const img = await createImageBitmap(file).catch(() => null); if (!img) return file;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise(r => c.toBlob(r, type, 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, type === 'image/webp' ? '.webp' : '.jpg'), { type }) : file;
  }
  A.upload = async (file, siteId = A.S.siteId) => {
    if (!file || !/^image\//.test(file.type)) throw new Error('이미지 파일만 올릴 수 있습니다.');
    const f = await shrink(file);
    if (f.size > 10 * 1024 * 1024) throw new Error('10MB 이하 이미지만 올릴 수 있습니다.');
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const d = new Date(), path = `${siteId}/${d.getFullYear()}${pad(d.getMonth() + 1)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await A.sb.storage.from('media').upload(path, f, { cacheControl: '31536000', contentType: f.type });
    if (error) throw error;
    return A.sb.storage.from('media').getPublicUrl(path).data.publicUrl;
  };
  A.pickFile = () => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => res(i.files[0]); i.click(); });
  /* 이미지 칸: 클릭 · 끌어다 놓기 · 붙여넣기 */
  A.dropHTML = (url, ph, cls = '') => `<div class="drop ${cls}" tabindex="0" role="button" aria-label="${esc(ph)}">${url ? `<img src="${esc(url)}" alt=""><button type="button" class="drop__x" data-drop-x aria-label="이미지 빼기">✕</button>` : `<span class="drop__ph">${I('image')}<span>${esc(ph)}</span></span>`}</div>`;
  A.bindDrop = (el, onUrl, siteId) => {
    const go = async f => { if (!f) return; el.classList.add('is-busy'); try { onUrl(await A.upload(f, siteId)); } catch (e) { A.fail(e, '이미지를 올리지 못했습니다.'); } finally { el.classList.remove('is-busy'); } };
    el.addEventListener('click', async e => { if (e.target.closest('[data-drop-x]')) { e.stopPropagation(); onUrl(''); return; } go(await A.pickFile()); });
    el.addEventListener('keydown', async e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(await A.pickFile()); } });
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('is-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('is-over'));
    el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('is-over'); go(e.dataTransfer.files[0]); });
  };

  /* ---------- 상태 ---------- */
  const S = A.S = {
    user: null, role: { admin: false, sites: [] }, sites: [], siteId: store.get('iuxadm-site') || '', preview: null,
    period: { days: +store.get('iuxadm-period') || 30, from: null, to: null },
    notiRead: JSON.parse(store.get('iuxadm-noti') || '[]'), newCounts: {}, view: '', tab: '', arg: '', mini: store.get('iuxadm-side') === '1'
  };
  A.isClient = () => !S.role.admin || !!S.preview;
  A.site = id => S.sites.find(s => s.id === (id || S.siteId));
  A.range = () => {
    if (S.period.from && S.period.to) return { from: new Date(S.period.from + 'T00:00:00'), to: new Date(new Date(S.period.to + 'T00:00:00').getTime() + 864e5) };
    const to = new Date(new Date(A.ymd(new Date()) + 'T00:00:00').getTime() + 864e5);
    return { from: new Date(to - S.period.days * 864e5), to };
  };
  A.prevRange = () => { const r = A.range(), d = r.to - r.from; return { from: new Date(r.from - d), to: r.from }; };

  /* ---------- 데이터 ---------- */
  A.loadSites = async () => {
    const cols = 'id,name,category,domain,stage,manager,color,active,notify_emails,allowed_origins,ops,created_at,updated_at';
    let { data, error } = await A.sb.from('sites').select(cols + ',turnstile_key').order('created_at');
    if (error && /turnstile_key/.test(error.message)) ({ data, error } = await A.sb.from('sites').select(cols).order('created_at')); // v3 SQL 실행 전
    if (error) throw error;
    S.sites = data || [];
    if (!S.sites.some(s => s.id === S.siteId)) S.siteId = S.sites[0]?.id || '';
  };
  A.refreshCounts = async () => {
    const { data } = await A.sb.from('inquiries').select('site_id').eq('status', 'new');
    S.newCounts = {}; (data || []).forEach(r => { S.newCounts[r.site_id] = (S.newCounts[r.site_id] || 0) + 1; });
    S.newInq = data || [];
    paintSide(); paintNoti();
  };

  /* ---------- 라우팅 ---------- */
  A.go = hash => { if (location.hash === hash) route(); else location.hash = hash; };
  A.siteHash = (tab = 'dash', id = S.siteId) => `#/site/${encodeURIComponent(id)}/${tab}`;
  addEventListener('hashchange', () => S.user && route());
  async function route() {
    const [, v, a, b, c] = location.hash.split('/');
    let view = v || '', tab = '', arg = '';
    if (view === 'site') { if (a && S.sites.some(s => s.id === decodeURIComponent(a))) S.siteId = decodeURIComponent(a); tab = b || 'dash'; arg = c ? decodeURIComponent(c) : ''; store.set('iuxadm-site', S.siteId); }
    if (A.isClient() && view !== 'site') { view = 'site'; tab = 'dash'; }
    if (!A.isClient() && !['overview', 'build', 'hosting', 'accounts', 'site'].includes(view)) view = 'overview';
    if (S.preview && S.preview !== S.siteId) S.preview = S.siteId;
    if (!S.siteId && view === 'site') view = A.isClient() ? 'none' : 'build';
    S.view = view; S.tab = tab; S.arg = arg;
    paintHeader(); paintSide();
    $('.app')?.classList.remove('is-open');
    const main = $('#main'); main.innerHTML = '<p class="loading">불러오는 중…</p>'; scrollTo(0, 0);
    const fn = view === 'site' ? A.views['site:' + tab] || A.views['site:dash'] : A.views[view];
    try { await fn?.(main, arg); } catch (e) { main.innerHTML = `<div class="empty">화면을 불러오지 못했습니다.<br><small>${esc(e.message)}</small></div>`; console.error(e); }
  }
  A.route = route;

  /* ---------- 레이아웃 ---------- */
  function shell() {
    $('#root').innerHTML = `<div class="app${S.mini ? ' is-mini' : ''}">
      <header class="hd" id="hd"></header>
      <div class="body"><aside class="side" id="side"></aside><div class="side-veil" data-veil></div><main class="main" id="main"></main></div></div>`;
    $('[data-veil]').addEventListener('click', () => $('.app').classList.remove('is-open'));
  }

  function paintHeader() {
    const hd = $('#hd'); if (!hd) return;
    const client = A.isClient(), cur = A.site();
    const name = S.user.user_metadata?.name || (client ? `${cur?.name || ''} 담당자` : '슈퍼관리자');
    hd.innerHTML = `
      <div class="hd__l">
        <button class="iconbtn" data-side title="메뉴">${I('menu')}</button>
        ${client && cur ? `<div class="brand brand--client"><span class="avatar" style="background:${esc(cur.color || A.TINTS[0])}">${esc(A.initial(cur.name))}</span><b>${esc(cur.name)}</b><small>ADMIN</small></div>`
          : `<a href="#/overview" class="brand"><b>IUX<i>.</i>studio</b><small>SUPER ADMIN</small></a>`}
      </div>
      <div class="hd__search" id="hdSearch"><div class="search"><input id="q" placeholder="${client ? '메뉴 검색' : '사이트, 도메인, 메뉴 검색'}" autocomplete="off" aria-label="검색">${I('search', 'i--sm')}<div class="qres" id="qres" hidden></div></div><button class="btn btn--sm only-m" data-qclose>취소</button></div>
      <div style="flex:1" class="only-m"></div>
      <div class="hd__r">
        <button class="iconbtn only-m" data-qopen title="검색">${I('search')}</button>
        <div class="rel" style="margin-right:6px"><button class="iconbtn" data-noti title="알림">${I('bell')}<span class="badge-dot" id="notiDot" hidden></span></button><div id="notiPop"></div></div>
        <div class="rel"><button class="userbtn" data-user title="내 계정"><span class="avatar avatar--round">${esc(A.initial(name))}</span><span class="userbtn__txt"><b>${esc(name)}</b><small>${client ? '사이트 관리자' : '전체 권한'}</small></span><svg class="i i--xs" viewBox="0 0 24 24"><path d="${P.chev}"/></svg></button><div id="userPop"></div></div>
        <button class="iconbtn" data-logout title="로그아웃">${I('logout')}</button>
      </div>`;
    hd.querySelector('[data-side]').onclick = () => {
      if (matchMedia('(max-width:1023px)').matches) $('.app').classList.toggle('is-open');
      else { S.mini = !S.mini; store.set('iuxadm-side', S.mini ? '1' : '0'); $('.app').classList.toggle('is-mini', S.mini); }
    };
    hd.querySelector('[data-logout]').onclick = () => A.sb.auth.signOut();
    hd.querySelector('[data-noti]').onclick = () => toggleNoti();
    hd.querySelector('[data-user]').onclick = () => toggleUser();
    hd.querySelector('[data-qopen]').onclick = () => { $('#hdSearch').classList.add('is-open'); $('#q').focus(); };
    hd.querySelector('[data-qclose]').onclick = () => { $('#hdSearch').classList.remove('is-open'); $('#q').value = ''; $('#qres').hidden = true; };
    bindSearch(); paintNoti();
  }

  function bindSearch() {
    const q = $('#q'), box = $('#qres'); let sel = 0, res = [];
    const draw = () => {
      const s = q.value.trim().toLowerCase();
      if (!s) { box.hidden = true; return; }
      res = [];
      const client = A.isClient();
      if (!client) S.sites.filter(x => (x.name + ' ' + (x.domain || '') + ' ' + x.id).toLowerCase().includes(s)).forEach(x => res.push({ name: x.name, sub: x.domain || x.id, kind: '사이트', go: A.siteHash('dash', x.id) }));
      const menus = [...(client ? [] : [['#/overview', '전체 현황'], ['#/build', '사이트 제작'], ['#/hosting', '도메인 · 호스팅'], ['#/accounts', '관리자 계정 관리']]), ...siteTabs().map(([t, l]) => [A.siteHash(t), l])];
      menus.filter(([, l]) => l.toLowerCase().replace(/ · /g, '').includes(s.replace(/\s/g, '')) || l.toLowerCase().includes(s)).forEach(([go, l]) => res.push({ name: l, sub: go.startsWith('#/site') ? A.site()?.name : '메뉴', kind: '메뉴', go }));
      res = res.slice(0, 8); sel = 0;
      box.innerHTML = res.length ? res.map((r, i) => `<button data-i="${i}" class="${i === sel ? 'is-on' : ''}"><span><b>${esc(r.name)}</b><small>${esc(r.sub || '')}</small></span><em>${r.kind}</em></button>`).join('') : '<div class="noti__empty">검색 결과가 없습니다.</div>';
      box.hidden = false;
    };
    const pick = i => { const r = res[i]; if (!r) return; q.value = ''; box.hidden = true; $('#hdSearch').classList.remove('is-open'); A.go(r.go); };
    q.addEventListener('input', draw);
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % Math.max(res.length, 1); $$('button', box).forEach((b, i) => b.classList.toggle('is-on', i === sel)); }
      if (e.key === 'Enter') pick(sel);
      if (e.key === 'Escape') { q.value = ''; box.hidden = true; }
    });
    box.addEventListener('mousedown', e => { const b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); pick(+b.dataset.i); } });
    q.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
  }

  /* 알림: 새 문의 + 도메인/호스팅/SSL 확인 필요 */
  function notiItems() {
    const client = A.isClient(), list = [];
    Object.entries(S.newCounts).filter(([id]) => !client || id === S.siteId).forEach(([id, n]) => list.push({ id: `inq-${id}-${n}`, title: `새 문의 ${n}건`, sub: A.site(id)?.name || id, tag: '문의', c: 'var(--blue)', go: A.siteHash('inq', id) }));
    A.opsAlerts(client ? [A.site()].filter(Boolean) : S.sites).forEach(a => list.push({ id: a.id, title: a.title, sub: a.sub, tag: a.tag, c: a.c, go: client ? A.siteHash('service') : '#/hosting' }));
    return list;
  }
  A.opsAlerts = sites => {
    const out = [];
    sites.forEach(s => {
      const o = s.ops || {};
      if (s.stage !== 'build' && o.ssl && o.ssl !== 'ok') out.push({ id: `ssl-${s.id}-${o.ssl}`, kind: 'SSL', title: `${s.name} · SSL 인증서 ${o.ssl === 'none' ? '미설치' : '확인 필요'}`, sub: `${s.domain || ''} · 설치 · 점검 필요`, tag: 'SSL', c: o.ssl === 'none' ? 'var(--neg)' : 'var(--warn)', site: s, date: '', note: '설치 · 점검 필요' });
      [['domainExp', '도메인', s.domain], ['hostExp', '호스팅', o.host]].forEach(([k, label, what]) => {
        const d = A.dday(o[k]);
        if (d.n <= 30) out.push({ id: `${k}-${s.id}-${o[k]}`, kind: d.t, title: `${s.name} · ${label} ${what || ''}`.trim(), sub: `${A.dot(o[k])} · ${o.auto ? '자동 연장 설정됨' : '수동 연장 필요'}`, tag: d.t, c: d.n <= 14 ? 'var(--neg)' : 'var(--warn)', site: s, date: A.dot(o[k]), note: o.auto ? '자동 연장 설정됨' : '수동 연장 필요', n: d.n });
      });
    });
    return out.sort((a, b) => (a.n ?? -1) - (b.n ?? -1));
  };
  function paintNoti() {
    const dot = $('#notiDot'); if (!dot) return;
    const unread = notiItems().filter(n => !S.notiRead.includes(n.id)).length;
    dot.hidden = !unread; dot.textContent = unread > 9 ? '9+' : unread;
  }
  function closePops() { $('#notiPop') && ($('#notiPop').innerHTML = ''); $('#userPop') && ($('#userPop').innerHTML = ''); $('[data-user]')?.classList.remove('is-open'); }
  function toggleNoti() {
    const box = $('#notiPop'); if (box.innerHTML) return closePops(); closePops();
    const items = notiItems();
    box.innerHTML = `<div class="pop__veil" data-close></div><div class="pop noti"><div class="noti__h"><b>알림</b><button class="linkbtn" data-all>모두 읽음</button></div><div class="noti__list">${items.length ? items.map(n => { const read = S.notiRead.includes(n.id); return `<button class="noti__it" data-go="${esc(n.go)}" data-id="${esc(n.id)}"><i style="background:${n.c};opacity:${read ? 0 : 1}"></i><span><b style="font-weight:${read ? 500 : 700}">${esc(n.title)}</b><small>${esc(n.sub)}</small></span><em style="color:${n.c}">${esc(n.tag)}</em></button>`; }).join('') : '<div class="noti__empty">새 알림이 없습니다.</div>'}</div></div>`;
    const save = () => { store.set('iuxadm-noti', JSON.stringify(S.notiRead.slice(-200))); paintNoti(); };
    box.querySelector('[data-close]').onclick = closePops;
    box.querySelector('[data-all]').onclick = () => { S.notiRead = [...new Set([...S.notiRead, ...items.map(n => n.id)])]; save(); closePops(); };
    box.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { S.notiRead = [...new Set([...S.notiRead, b.dataset.id])]; save(); closePops(); A.go(b.dataset.go); });
  }
  function toggleUser() {
    const box = $('#userPop'); if (box.innerHTML) return closePops(); closePops();
    $('[data-user]').classList.add('is-open');
    const client = A.isClient(), name = S.user.user_metadata?.name || (client ? '사이트 담당자' : '슈퍼관리자');
    const menu = [['me', '내 정보 수정', 'me'], ['key', '비밀번호 변경', 'pw'], client ? ['help', '고객센터 문의', 'help'] : ['team', '관리자 계정 관리', 'accounts']];
    box.innerHTML = `<div class="pop__veil" data-close></div><div class="pop umenu">
      <div class="umenu__me"><span class="avatar avatar--round">${esc(A.initial(name))}</span><div><b>${esc(name)}</b><small>${esc(S.user.email)}</small></div></div>
      <dl class="umenu__info"><dt>권한</dt><dd>${client ? '사이트 관리자' : '전체 권한 (Owner)'}</dd><dt>관리 사이트</dt><dd>${client ? esc(A.site()?.name || '-') : S.sites.length + '개'}</dd><dt>최근 로그인</dt><dd>${S.user.last_sign_in_at ? A.dtime(S.user.last_sign_in_at) : '-'}</dd></dl>
      <div class="umenu__list">${menu.map(([ic, l, k]) => `<button data-k="${k}">${I(ic, 'i--sm')}${l}</button>`).join('')}</div>
      <div class="umenu__list"><button class="is-neg" data-k="out">${I('logout', 'i--sm')}로그아웃</button></div></div>`;
    box.querySelector('[data-close]').onclick = closePops;
    box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      closePops(); const k = b.dataset.k;
      if (k === 'out') return A.sb.auth.signOut();
      if (k === 'accounts') return A.go('#/accounts');
      A.views['dlg:' + k]?.();
    });
  }

  /* 사이트 메뉴 그룹: 현황 → 통계 분석 → 콘텐츠 → 고객 소통 → 운영 */
  const siteGroups = A.siteGroups = () => [
    ['', [['dash', '대시보드']]],
    ['통계 분석', [['traffic', '유입 · 검색어'], ['device', '기기 · OS'], ['exit', '이탈 분석']]],
    ['콘텐츠', [['content', '콘텐츠 관리'], ['seo', 'SEO 관리']]],
    ['고객 소통', [['inq', '문의 관리'], ['board', '게시판']]],
    ['운영', A.isClient() ? [['service', '내 서비스']] : [['settings', '사이트 설정']]]
  ];
  const siteTabs = A.siteTabs = () => siteGroups().flatMap(g => g[1]);
  function paintSide() {
    const side = $('#side'); if (!side) return;
    const client = A.isClient(), cur = A.site(), newN = S.newCounts[S.siteId] || 0;
    const top = [['overview', '전체 현황'], ['build', '사이트 제작'], ['hosting', '도메인 · 호스팅']];
    const theme = document.documentElement.dataset.theme;
    side.innerHTML = `
      ${client ? '' : `<button class="side__new" data-new title="사이트 만들기">${I('plus')}<span class="lbl">사이트 만들기</span></button>
      <nav class="nav">${top.map(([v, l]) => `<a href="#/${v}" class="${S.view === v ? 'is-on' : ''}" title="${l}">${I(v)}<span class="lbl">${l}</span></a>`).join('')}</nav>`}
      <div style="display:flex;flex-direction:column;gap:8px">
        ${client ? '' : `<div class="side__sep"></div><div class="side__lbl">사이트 관리</div>
        ${cur ? `<button class="sitepick" data-pick title="사이트 선택"><span class="avatar" style="background:${esc(cur.color || A.TINTS[0])}">${esc(A.initial(cur.name))}</span><span><b>${esc(cur.name)}</b><small>${esc(cur.category)}</small></span>${I('updown', 'i--sm')}</button>` : ''}`}
        ${cur ? `<nav class="nav nav--site">${siteGroups().map(([g, items]) => `${g ? `<div class="nav__grp"><span>${g}</span></div>` : ''}${items.map(([t, l]) => `<a href="${A.siteHash(t)}" class="${S.view === 'site' && S.tab === t ? 'is-on' : ''}" title="${l}">${I(t)}<span class="lbl">${l}</span>${t === 'inq' && newN ? `<span class="cnt">${newN}</span>` : ''}</a>`).join('')}`).join('')}</nav>` : ''}
      </div>
      <div class="side__foot">
        ${S.preview ? `<button class="side__back" data-back>슈퍼어드민으로 돌아가기</button>` : ''}
        <div id="themeMenu"></div>
        <button class="themebtn" data-theme-btn title="테마 선택"><i>${I(theme === 'light' ? 'sun' : 'moon', 'i--sm')}</i><span class="lbl">테마 선택</span></button>
      </div>`;
    side.querySelector('[data-new]')?.addEventListener('click', () => A.go('#/build'));
    side.querySelector('[data-pick]')?.addEventListener('click', () => A.sitePicker());
    side.querySelector('[data-back]')?.addEventListener('click', () => { S.preview = null; A.go(A.siteHash('dash')); });
    side.querySelector('[data-theme-btn]').addEventListener('click', () => {
      const m = $('#themeMenu'); if (m.innerHTML) { m.innerHTML = ''; return; }
      const cur = document.documentElement.dataset.theme;
      m.innerHTML = `<div class="thememenu">${[['dark', '다크 모드', 'moon'], ['light', '화이트 모드', 'sun']].map(([v, l, ic]) => `<button data-v="${v}" class="${cur === v ? 'is-on' : ''}">${I(ic, 'i--sm')}${l}</button>`).join('')}</div>`;
      m.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { document.documentElement.dataset.theme = b.dataset.v; store.set('iuxadm-theme', b.dataset.v); paintSide(); });
    });
  }
  A.paintSide = paintSide; A.paintHeader = paintHeader;

  A.sitePicker = () => {
    let cat = '전체', q = '';
    const m = A.modal({ title: '사이트 선택', wide: true, body: `<div class="search" style="max-width:none"><input id="spq" placeholder="사이트명 또는 도메인 검색" style="padding-left:18px">${I('search', 'i--sm')}</div><div class="chips" id="spc"></div><div class="picklist" id="spl"></div>` });
    const draw = () => {
      const counts = Object.fromEntries(['전체', ...A.CATS.slice(0, 5)].map(c => [c, c === '전체' ? S.sites.length : S.sites.filter(s => s.category === c).length]));
      $('#spc', m.el).innerHTML = Object.entries(counts).map(([c, n]) => `<button class="chip${c === cat ? ' is-on' : ''}" data-c="${c}">${c}<small>${n}</small></button>`).join('');
      const list = S.sites.filter(s => (cat === '전체' || s.category === cat) && (s.name + ' ' + (s.domain || '')).toLowerCase().includes(q.toLowerCase()));
      $('#spl', m.el).innerHTML = list.length ? list.map(s => `<button data-id="${esc(s.id)}" class="${s.id === S.siteId ? 'is-on' : ''}"><span class="avatar" style="background:${esc(s.color || A.TINTS[0])}">${esc(A.initial(s.name))}</span><span><b>${esc(s.name)}</b><small>${esc(s.domain || s.id)}</small></span><aside><span class="stage stage--${s.stage}">${A.STAGE[s.stage]}</span><small>${esc(s.category)}</small></aside></button>`).join('') : '<div class="empty" style="grid-column:1/-1">조건에 맞는 사이트가 없습니다.</div>';
    };
    draw();
    $('#spq', m.el).addEventListener('input', e => { q = e.target.value; draw(); });
    $('#spc', m.el).addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { cat = b.dataset.c; draw(); } });
    $('#spl', m.el).addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { m.close(); A.go(A.siteHash(S.view === 'site' ? S.tab : 'dash', b.dataset.id)); A.refreshCounts(); } });
  };

  /* ---------- 공통 화면 조각 ---------- */
  A.kpi = (label, value, ic, sub = '', cls = '') => `<div class="card kpi"><div><p>${label}</p><b class="${cls}">${value}</b>${sub ? `<small>${sub}</small>` : ''}</div><span class="kpi__ic">${I(ic)}</span></div>`;
  A.delta = (cur, prev, unit = '%', invert = false) => {
    if (!prev && !cur) return '';
    if (!prev) return '<em>신규</em> 이전 기간 데이터 없음';
    const d = unit === '%p' ? Math.round((cur - prev) * 10) / 10 : Math.round((cur - prev) / prev * 1000) / 10;
    const good = invert ? d <= 0 : d >= 0;
    return `<em class="${good ? '' : 'is-down'}">${d > 0 ? '+' : ''}${d}${unit}</em> 이전 기간 대비`;
  };
  A.siteHead = (title, { open = true, extra = '' } = {}) => {
    const s = A.site(); if (!s) return '';
    return `<div class="ph"><div><div class="ph__crumb"><span>${esc(s.name)}</span><small>${esc(s.domain || '')}</small><span class="stage stage--${s.stage}">${A.STAGE[s.stage]}</span></div>
      <div class="ph__t"><h1>${esc(title)}</h1>${open && !A.isClient() ? `<button class="btn btn--line btn--sm" data-preview>고객 어드민 열기</button>` : ''}</div></div>${extra}</div>`;
  };
  A.bindHead = root => root.querySelector('[data-preview]')?.addEventListener('click', () => { S.preview = S.siteId; A.go(A.siteHash(S.tab)); A.toast('고객사 담당자에게 보이는 화면입니다.'); });
  A.periodHTML = () => {
    const r = A.range(), custom = !!S.period.from;
    return `<div class="period" id="period"><button class="period__range" data-dp>${A.dot(r.from)} → ${A.dot(new Date(r.to - 864e5))} <small>▼</small></button><span class="period__sep"></span>
      <div class="seg">${[7, 30, 90].map(d => `<button data-d="${d}" class="${!custom && S.period.days === d ? 'is-on' : ''}">${d}일</button>`).join('')}</div><div id="dp"></div></div>`;
  };
  A.bindPeriod = (root, onChange) => {
    const p = root.querySelector('#period'); if (!p) return;
    p.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { S.period = { days: +b.dataset.d, from: null, to: null }; store.set('iuxadm-period', b.dataset.d); onChange(); });
    p.querySelector('[data-dp]').onclick = () => {
      const box = p.querySelector('#dp'); if (box.innerHTML) { box.innerHTML = ''; return; }
      const r = A.range();
      box.innerHTML = `<div class="dp"><b>기간 직접 선택</b><div class="row"><input type="date" class="inp" id="dpf" value="${A.ymd(r.from)}"><span class="muted">→</span><input type="date" class="inp" id="dpt" value="${A.ymd(new Date(r.to - 864e5))}"></div><div class="row row--end"><button class="btn btn--sm" data-c>취소</button><button class="btn btn--primary btn--sm" data-ok>적용</button></div></div>`;
      box.querySelector('[data-c]').onclick = () => box.innerHTML = '';
      box.querySelector('[data-ok]').onclick = () => { const f = box.querySelector('#dpf').value, t = box.querySelector('#dpt').value; if (!f || !t || f > t) return A.toast('기간을 확인해 주세요.', true); S.period = { days: Math.round((new Date(t) - new Date(f)) / 864e5) + 1, from: f, to: t }; onChange(); };
    };
  };
  A.barsHTML = (rows, { grey = false, neg = false, total } = {}) => {
    const sum = total ?? rows.reduce((a, r) => a + r.v, 0), max = Math.max(...rows.map(r => r.v), 1);
    return rows.length ? `<div class="bars">${rows.map(r => `<div><div class="bar__top"><b>${esc(r.label)}</b><span>${A.n(r.v)} · ${A.pct(r.v, sum)}%</span></div><div class="bar__track"><i class="${grey ? 'is-grey' : neg ? 'is-neg' : ''}" style="width:${Math.max(2, r.v / max * 100)}%"></i></div></div>`).join('')}</div>` : '<p class="empty">아직 데이터가 없습니다.</p>';
  };

  /* ---------- 로그인 ---------- */
  let INIT_HASH = location.hash;
  function authScreen(mode, msg) {
    $('#layer').innerHTML = '';
    $('#root').innerHTML = `<section class="auth"><div class="auth__box">
      <a class="brand"><b>IUX<i>.</i>studio</b><small>ADMIN</small></a>
      ${mode === 'setup' ? `<h1>연결 설정이 필요합니다</h1><p class="note">${msg}</p>` : mode === 'pw' ? `<h1>새 비밀번호 설정</h1>
        <form class="stack" id="pwf" style="gap:16px"><label class="field">새 비밀번호 <small>8자 이상</small><input name="pw" type="password" minlength="8" required autocomplete="new-password"></label><p class="auth__err" id="err" hidden></p><button class="btn btn--primary btn--block">저장</button></form>`
        : `<h1>관리자 로그인</h1><form class="stack" id="lf" style="gap:16px"><label class="field">이메일<input name="email" type="email" required autocomplete="username"></label><label class="field">비밀번호<input name="password" type="password" required autocomplete="current-password"></label>
        <p class="auth__err" id="err" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p><button class="btn btn--primary btn--block">로그인</button><button type="button" class="linkbtn" id="forgot">비밀번호를 잊으셨나요?</button></form>`}
    </div></section>`;
    const ko = m => /Invalid login/i.test(m) ? '이메일 또는 비밀번호가 올바르지 않습니다.'
      : /rate limit|security purposes|after \d+ seconds/i.test(m) ? '메일 발송 한도(시간당 약 2통)를 넘었습니다. 1시간 뒤 다시 시도하거나 운영자에게 비밀번호 초기화를 요청해 주세요.'
      : /not confirmed/i.test(m) ? '이메일 인증이 완료되지 않은 계정입니다.'
      : /Password should be|weak/i.test(m) ? '비밀번호는 8자 이상으로 입력해 주세요.'
      : /same.*password|different from the old/i.test(m) ? '이전과 다른 비밀번호를 입력해 주세요.'
      : m;
    const err = t => { $('#err').textContent = ko(t); $('#err').hidden = false; };
    $('#lf')?.addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target; f.querySelector('button').disabled = true;
      const { error } = await A.sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      f.querySelector('button').disabled = false;
      if (error) err(error.message);
    });
    $('#forgot')?.addEventListener('click', async () => {
      const email = $('#lf').email.value.trim(); if (!email) return err('이메일을 먼저 입력해 주세요.');
      if (!confirm(email + ' 로 비밀번호 재설정 메일을 보낼까요?\n(메일은 시간당 약 2통까지만 보낼 수 있습니다)')) return;
      const { error } = await A.sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
      error ? err(error.message) : A.toast('비밀번호 재설정 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.');
    });
    $('#pwf')?.addEventListener('submit', async e => {
      e.preventDefault();
      const { error } = await A.sb.auth.updateUser({ password: e.target.pw.value });
      if (error) return err(error.message);
      A.toast('비밀번호가 저장되었습니다.'); INIT_HASH = ''; history.replaceState(null, '', location.pathname); start();
    });
  }

  async function start() {
    try {
      const [{ data: role, error: e1 }] = await Promise.all([A.sb.rpc('my_role')]);
      if (e1) throw e1;
      S.role = role;
      await A.loadSites();
    } catch (e) { return authScreen('login', '정보를 불러오지 못했습니다. ' + (e.message || '')); }
    if (!S.role.admin && !S.sites.length) { await A.sb.auth.signOut(); return authScreen('login', '연결된 사이트가 없는 계정입니다. 운영자에게 문의해 주세요.'); }
    if (/access_token|type=/.test(location.hash) || !location.hash) history.replaceState(null, '', location.pathname + (A.isClient() ? A.siteHash('dash') : '#/overview'));
    shell(); route(); A.refreshCounts();
  }

  /* ---------- 아이콘 툴팁 (헤더 아이콘 · 접힌 사이드 메뉴) ---------- */
  (() => {
    let tipEl, cur;
    const hide = () => { if (tipEl) tipEl.hidden = true; cur = null; };
    document.addEventListener('mouseover', e => {
      const t = e.target.closest?.('#hd [title], #hd [data-tip], .app.is-mini .side [title], .app.is-mini .side [data-tip]');
      if (!t) return hide();
      if (t.hasAttribute('title')) { t.dataset.tip = t.title; t.removeAttribute('title'); }
      if (t === cur) return;
      if (t.closest('.side') && matchMedia('(max-width:1023px)').matches) return hide();
      cur = t;
      if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
      tipEl.textContent = t.dataset.tip; tipEl.hidden = false;
      const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, side = !!t.closest('.side');
      const x = side ? r.right + 10 : Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
      const y = side ? r.top + r.height / 2 - h / 2 : r.bottom + 8;
      tipEl.className = 'tip' + (side ? ' tip--r' : ''); tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    });
    addEventListener('scroll', hide, true); document.addEventListener('mousedown', hide);
  })();

  A.boot = () => {
    if (!CFG.supabaseUrl || !CFG.anonKey) return authScreen('setup', '<code>admin/config.js</code> 에 Supabase Project URL 과 anon key 를 넣어주세요.');
    if (!window.supabase) return authScreen('setup', 'Supabase 라이브러리를 불러오지 못했습니다. 광고 차단 확장 프로그램을 끄거나 잠시 후 새로고침해 주세요.');
    A.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.anonKey);
    let booted = false;
    A.sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY' || (ev === 'SIGNED_IN' && /type=(invite|recovery)/.test(INIT_HASH))) { S.user = session.user; return authScreen('pw'); }
      if (!session) { S.user = null; booted = false; return authScreen('login'); }
      if (ev === 'USER_UPDATED') { S.user = session.user; paintHeader(); return; }
      if (!booted || S.user?.id !== session.user.id) { booted = true; S.user = session.user; setTimeout(start); }
    });
  };
})();
