/* 관리자 '콘텐츠 관리 · SEO 관리'에서 저장한 내용을 홈페이지에 적용합니다.
   저장된 내용이 없거나 불러오지 못하면 js/content.js 의 기본값을 그대로 씁니다. */
window.SiteReady = (async () => {
  'use strict';
  const S = window.SITE;

  /* ---------- 맨 위로 버튼 (모든 페이지 공통, 조금 내리면 나타남) ---------- */
  const top = document.createElement('a');
  top.className = 'totop'; top.href = '#top'; top.setAttribute('aria-label', '맨 위로');
  top.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(top);
  const onTop = () => top.classList.toggle('is-on', scrollY > 400);
  addEventListener('scroll', onTop, { passive: true }); onTop();

  if (window.IUXCloud && S.cloud) IUXCloud.init(S.cloud);
  if (!window.IUXCloud?.ready) return S;
  const r = await Promise.race([IUXCloud.getSite(), new Promise(res => setTimeout(() => res(null), 2500))]);
  if (!r) return S;
  const c = r.content || {}, seo = r.seo || {};

  /* ---------- 콘텐츠 ---------- */
  if (Array.isArray(c.hero) && c.hero.length) S.hero.slides = c.hero.map(h => ({ cat: h.cat || '', title: h.title || '', desc: h.desc || '', img: h.img || '', link: h.link || '', btn: h.btn || '', newTab: !!h.newTab }));
  if (Array.isArray(c.works)) {
    const hide = S.worksHide || [];
    const list = c.works.filter(w => !hide.includes(w.name)).map(w => ({ name: w.name || '프로젝트', cat: w.cat || '', img: w.img || '', link: w.link || '' }));
    // js/content.js 의 샘플 사이트(link 있는 항목): 같은 이름이면 링크를 채우고, 없으면 링크 달린 마지막 항목 뒤에 추가
    list.forEach(w => { if (!w.link) w.link = S.works.find(b => b.name === w.name)?.link || ''; });
    const extra = S.works.filter(b => b.link && !list.some(w => w.name === b.name));
    const last = list.map(w => !!w.link).lastIndexOf(true);
    list.splice(last + 1, 0, ...extra);
    S.works = list;
  }
  if (Array.isArray(c.marquee) && c.marquee.length) S.marquee = c.marquee.filter(Boolean);
  if (c.sections) ['services', 'process', 'about', 'cta'].forEach(k => { if (c.sections[k]) S.sections[k] = c.sections[k]; });
  if (c.company) Object.keys(c.company).forEach(k => { if (c.company[k]) S.company[k] = c.company[k]; });
  if (Array.isArray(c.popups)) S.popups = c.popups.map(p => ({ ...p, key: p.key || p.id, on: !!p.on }));
  if (c.popRoll) S.popupRoll = { on: !!c.popRoll.on, sec: c.popRoll.sec || 5 };
  S.pages = Array.isArray(c.pages) ? c.pages : [];

  /* ---------- 서브 페이지를 메뉴에 추가 ---------- */
  const tops = S.pages.filter(p => p.on && !p.parent);
  if (tops.length) {
    const here = new URLSearchParams(location.search).get('p');
    const arrow = '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>';
    const link = (p, mobile) => { const a = document.createElement('a'); a.href = 'page.html?p=' + encodeURIComponent(p.slug); a.innerHTML = (p.name || '').replace(/[<>&]/g, '') + (mobile ? arrow : ''); if (here === p.slug) a.className = 'is-on'; return a; };
    const gnb = document.querySelector('.gnb'), mnav = document.querySelector('.mmenu__nav');
    const before = n => n && [...n.children].find(a => /notice\.html/.test(a.getAttribute('href') || ''));
    tops.forEach(p => { gnb?.insertBefore(link(p), before(gnb) || null); mnav?.insertBefore(link(p, true), before(mnav) || null); });
  }

  /* ---------- '메뉴에 표시' 한 게시판 ---------- */
  S.boards = r.boards || [];
  const menuBoards = S.boards.filter(b => b.show_menu && !['notice', 'faq'].includes(b.slug));
  if (menuBoards.length) {
    const cur = new URLSearchParams(location.search).get('b');
    const arrow = '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>';
    const gnb = document.querySelector('.gnb'), mnav = document.querySelector('.mmenu__nav');
    const before = n => n && [...n.children].find(a => /notice\.html/.test(a.getAttribute('href') || ''));
    menuBoards.forEach(b => [[gnb, ''], [mnav, arrow]].forEach(([nav, ic]) => {
      if (!nav) return; const a = document.createElement('a'); a.href = (b.kind === 'faq' ? 'faq.html?b=' : 'board.html?b=') + encodeURIComponent(b.slug);
      a.innerHTML = b.name.replace(/[<>&]/g, '') + ic; if (cur === b.slug) a.className = 'is-on'; nav.insertBefore(a, before(nav)?.nextSibling || null);
    }));
  }

  /* ---------- SEO ---------- */
  const file = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
  const key = file === 'page' ? 'page:' + new URLSearchParams(location.search).get('p') : file === 'index' || !file ? 'home' : file;
  const P = (seo.pages || {})[key];
  const meta = (attr, name, val) => {
    if (!val) return;
    let m = document.head.querySelector(`meta[${attr}="${name}"]`);
    if (!m) { m = document.createElement('meta'); m.setAttribute(attr, name); document.head.appendChild(m); }
    m.content = val;
  };
  if (P) {
    if (P.title) { document.title = P.title; meta('property', 'og:title', P.title); }
    meta('name', 'description', P.desc); meta('property', 'og:description', P.desc);
    meta('name', 'keywords', P.keywords); meta('property', 'og:image', P.og);
    if (P.noindex) meta('name', 'robots', 'noindex');
  }
  meta('name', 'google-site-verification', seo.google);
  meta('name', 'naver-site-verification', seo.naver);
  if (/^G-[A-Z0-9]+$/.test(seo.ga || '')) {
    const g = document.createElement('script'); g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + seo.ga; document.head.appendChild(g);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); }; gtag('js', new Date()); gtag('config', seo.ga);
  }
  return S;
})();
