/* 관리자 '콘텐츠 관리 > 서브 페이지'에서 만든 페이지를 보여줍니다. 주소: page.html?p=/about */
(async () => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('#year').textContent = new Date().getFullYear();
  const burger = $('#burger'), root = document.documentElement;
  const setMenu = v => { root.classList.toggle('menu-open', v); burger.setAttribute('aria-expanded', v); $('#mmenu').setAttribute('aria-hidden', !v); document.body.classList.toggle('lock', v); };
  burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));

  const S = await window.SiteReady;
  const slug = new URLSearchParams(location.search).get('p') || '';
  const pages = (S.pages || []).filter(p => p.on);
  const pg = pages.find(p => p.slug === slug);
  if (!pg) { $('#pgTitle').textContent = '페이지를 찾을 수 없습니다.'; $('#pgIntro').innerHTML = '<a href="./" style="color:var(--blue)">홈으로 가기</a>'; return; }
  const parent = pages.find(p => p.id === pg.parent);
  const top = parent || pg;
  document.title = document.title === 'IUX.STUDIO' || !document.title ? `${pg.title || pg.name} — ${S.company.name}` : document.title;
  $('#pgEyebrow').textContent = (parent ? parent.name : pg.name || '').toUpperCase();
  $('#pgTitle').textContent = pg.title || pg.name;
  $('#pgIntro').textContent = pg.intro || '';
  if (pg.banner) { $('#pgBannerImg').src = pg.banner; $('#pgBanner').hidden = false; }
  const family = [top, ...pages.filter(p => p.parent === top.id)];
  if (family.length > 1) {
    $('#pgTabs').hidden = false;
    $('#pgTabs').innerHTML = family.map(p => `<a href="page.html?p=${encodeURIComponent(p.slug)}"${p.id === pg.id ? ' aria-current="page"' : ''}>${esc(p.name)}</a>`).join('');
  }
  $('#pgBlocks').innerHTML = (pg.blocks || []).filter(b => b.t || b.b).map((b, i) => `<section class="subpage__block">
    <span class="num">${String(i + 1).padStart(2, '0')}</span>
    <div>${b.t ? `<h2>${esc(b.t)}</h2>` : ''}<div class="md">${window.IUXCloud ? IUXCloud.md(b.b || '') : esc(b.b)}</div></div></section>`).join('');
  document.querySelectorAll('.gnb a, .mmenu__nav a').forEach(a => { if ((a.getAttribute('href') || '').includes('p=' + encodeURIComponent(top.slug))) a.classList.add('is-on'); });
})();
