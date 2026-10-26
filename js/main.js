(async () => {
  'use strict';
  const S = await (window.SiteReady || Promise.resolve(window.SITE));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  if (motion) root.classList.add('js-motion');

  /* ---------- body scroll lock (모달/메뉴 중첩 대응) ---------- */
  const locks = new Set();
  const lock = (k, on) => { on ? locks.add(k) : locks.delete(k); document.body.classList.toggle('lock', locks.size > 0); };

  /* ---------- 회사 정보 ---------- */
  const C = S.company;
  const telHref = 'tel:' + C.tel.replace(/[^0-9+]/g, '');
  $$('[data-tel]').forEach(a => { a.href = telHref; a.textContent = C.tel; });
  $$('[data-mail]').forEach(a => { a.href = 'mailto:' + C.email; a.textContent = C.email; });
  const info = [['TEL', `<a href="${telHref}">${esc(C.tel)}</a>`], ['EMAIL', `<a href="mailto:${esc(C.email)}">${esc(C.email)}</a>`]];
  if (C.address) info.push(['ADDRESS', esc(C.address)]);
  if (C.bizNo) info.push(['사업자등록번호', esc(C.bizNo)]);
  const fi = $('#footerInfo'); if (fi) fi.innerHTML = info.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#year').textContent = new Date().getFullYear();

  /* ---------- 헤더 ---------- */
  const header = $('#header');
  const onScroll = () => header.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // 현재 섹션 메뉴 표시
  const navLinks = $$('.gnb a');
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    navLinks.forEach(a => a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['works', 'service', 'process', 'about', 'contact'].forEach(id => spy.observe(document.getElementById(id)));

  /* ---------- 모바일 메뉴 ---------- */
  const burger = $('#burger'), mmenu = $('#mmenu');
  const setMenu = v => {
    root.classList.toggle('menu-open', v);
    burger.setAttribute('aria-expanded', v); mmenu.setAttribute('aria-hidden', !v);
    lock('menu', v);
  };
  burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  $$('a', mmenu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  matchMedia('(min-width:960px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  /* ---------- 앵커 부드러운 스크롤 (거리 비례 시간 + ease-in-out) ---------- */
  let scrollAnim = 0;
  const stopScroll = () => { cancelAnimationFrame(scrollAnim); scrollAnim = 0; root.style.scrollBehavior = ''; };
  ['wheel', 'touchstart', 'keydown'].forEach(t => addEventListener(t, () => scrollAnim && stopScroll(), { passive: true }));
  const smoothTo = y => {
    stopScroll();
    const from = scrollY, dist = y - from;
    if (Math.abs(dist) < 2) return;
    const dur = Math.min(1100, Math.max(500, Math.abs(dist) * 0.35)), t0 = performance.now();
    const ease = p => p < .5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
    root.style.scrollBehavior = 'auto'; // CSS smooth 와 겹치지 않게
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + dist * ease(p));
      p < 1 ? (scrollAnim = requestAnimationFrame(step)) : stopScroll();
    };
    scrollAnim = requestAnimationFrame(step);
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!motion || !a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute('href').slice(1);
    const target = id === 'top' ? root : id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const y = id === 'top' ? 0 : target.getBoundingClientRect().top + scrollY - header.offsetHeight;
    smoothTo(Math.min(Math.max(0, y), root.scrollHeight - innerHeight));
    history.pushState(null, '', '#' + id);
  });

  /* ---------- 히어로 슬라이더 ---------- */
  const H = S.hero, slides = H.slides;
  const track = $('#heroTrack'), prog = $('#heroProgress');
  slides.forEach((s, k) => {
    const d = el('div', 'hero__slide');
    d.setAttribute('role', 'group'); d.setAttribute('aria-roledescription', 'slide'); d.setAttribute('aria-label', `${k + 1} / ${slides.length}`);
    d.innerHTML = s.img ? `<img src="${esc(s.img)}" alt="" ${k ? 'loading="lazy"' : 'fetchpriority="high"'}>` : '';
    track.appendChild(d);
  });
  $('#heroTotal').textContent = String(slides.length).padStart(2, '0');
  let cur = 0, timer, progAnim;

  const paintHero = () => {
    const s = slides[cur];
    $('#heroCat').textContent = s.cat;
    $('#heroDesc').textContent = s.desc;
    // 슬라이드 링크: 있으면 버튼 표시, 없으면 숨김 (기본 슬라이드는 포트폴리오로)
    const link = 'link' in s ? s.link : '#works', hl = $('#heroLink');
    hl.parentElement.style.visibility = link ? '' : 'hidden';
    if (link) { hl.href = link; $('#heroBtn').textContent = s.btn || 'MORE VIEW'; s.newTab ? (hl.target = '_blank', hl.rel = 'noopener') : (hl.removeAttribute('target'), hl.removeAttribute('rel')); }
    const t = $('#heroTitle');
    t.setAttribute('aria-label', s.title.replace(/\n/g, ' '));
    t.innerHTML = s.title.split('\n').map(line =>
      `<span class="ln" aria-hidden="true">${line.split(' ').map(w =>
        `<span class="w">${[...w].map(ch => `<span class="c">${esc(ch)}</span>`).join('')}</span>`).join('')}</span>`).join('');
    $('#heroNo').textContent = String(cur + 1).padStart(2, '0');
    track.style.transform = `translateX(${-cur * 100}%)`;
    $$('.hero__slide', track).forEach((d, k) => { d.classList.toggle('is-on', k === cur); d.setAttribute('aria-hidden', k !== cur); });
    if (H.autoplay) {
      progAnim?.cancel();
      progAnim = prog.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: H.interval * 1000, easing: 'linear', fill: 'forwards' });
    } else prog.style.transform = 'scaleX(1)';
    if (!motion) return;
    $$('.c', t).forEach((c, k) => c.animate([{ transform: 'translateY(110%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 300 + k * 50, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    $$('[data-hero-anim]').forEach((e, k) => e.animate([{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 350 + k * 110, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
  };
  const go = n => { cur = ((n % slides.length) + slides.length) % slides.length; paintHero(); restart(); };
  const restart = () => { clearInterval(timer); if (H.autoplay && slides.length > 1) timer = setInterval(() => go(cur + 1), H.interval * 1000); };
  $('#heroPrev').addEventListener('click', () => go(cur - 1));
  $('#heroNext').addEventListener('click', () => go(cur + 1));
  // 스와이프
  let sx = null;
  const hero = $('#top');
  hero.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1)); sx = null; });
  // 탭이 백그라운드일 땐 멈춤
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInterval(timer); progAnim?.pause(); } else { progAnim?.play(); restart(); } });
  paintHero(); restart();

  /* ---------- 섹션 문구 (서비스 · 프로세스 · 선택 이유 · 문의 배너) ---------- */
  const br = t => esc(t || '').replace(/\n/g, '<br>');
  const X = S.sections || {};
  if (X.services?.length) $('#svcGrid').innerHTML = X.services.map((v, i) => `<div class="card" data-reveal><p class="num">${String(i + 1).padStart(2, '0')}</p><p class="card__t">${esc(v.t)}</p><p class="card__d">${esc(v.d)}</p></div>`).join('');
  if (X.process) {
    $('#prEye').textContent = X.process.eyebrow || ''; $('#prTitle').innerHTML = br(X.process.title); $('#prLead').textContent = X.process.lead || '';
    if (X.process.steps?.length) $('#prSteps').innerHTML = X.process.steps.map((v, i, a) => `<li data-reveal><span${i === a.length - 1 ? ' class="on"' : ''}>${String(i + 1).padStart(2, '0')}</span><div><p>${esc(v.t)}</p><p>${esc(v.d)}</p></div></li>`).join('');
  }
  if (X.about) {
    $('#abEye').textContent = X.about.eyebrow || ''; $('#abTitle').innerHTML = br(X.about.title);
    if (X.about.items?.length) $('#abGrid').innerHTML = X.about.items.map(v => `<div class="why" data-reveal><p>${br(v.t)}</p><p>${esc(v.d)}</p></div>`).join('');
  }
  if (X.cta?.title) $('#ctaTitle').innerHTML = br(X.cta.title);

  /* ---------- 마키 ---------- */
  const group = () => { const g = el('div', 'marquee__group'); S.marquee.forEach(t => g.appendChild(el('span', '', esc(t)))); return g; };
  const mq = $('#marquee'); mq.appendChild(group()); const g2 = group(); g2.setAttribute('aria-hidden', 'true'); mq.appendChild(g2);

  /* ---------- 포트폴리오 ---------- */
  const grid = $('#works-grid'), catsBox = $('#workCats'), viewAll = $('#viewAll');
  let wCat = S.workCats[0], showAll = false;
  const plus = '<svg viewBox="0 0 56 56"><path d="M28 6v44M6 28h44" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>';
  S.workCats.forEach(c => {
    const b = el('button', 'chip', esc(c)); b.type = 'button'; b.setAttribute('role', 'tab');
    b.addEventListener('click', () => { wCat = c; renderWorks(); });
    catsBox.appendChild(b);
  });
  const renderWorks = () => {
    $$('.chip', catsBox).forEach(b => { const on = b.textContent === wCat; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
    const list = wCat === S.workCats[0] ? S.works : S.works.filter(w => w.cat === wCat);
    const shown = showAll ? list : list.slice(0, S.worksPerPage);
    grid.innerHTML = '';
    shown.forEach(w => {
      const a = el(w.link ? 'a' : 'button', 'work');
      if (w.link) { a.href = w.link; a.target = '_blank'; a.rel = 'noopener'; } else a.type = 'button';
      a.setAttribute('data-reveal', '');
      a.innerHTML = `<div class="work__thumb">${w.img ? `<img src="${esc(w.img)}" alt="${esc(w.name)}" loading="lazy">` : `<div class="work__ph">${esc(w.name)}</div>`}<div class="work__ov">${plus}</div></div>
        <p class="work__name">${esc(w.name)}</p><p class="work__cat">${esc(w.cat)}</p>`;
      if (!w.link) a.addEventListener('click', () => openLightbox(w));
      grid.appendChild(a);
    });
    $('#worksEmpty').hidden = list.length > 0;
    viewAll.parentElement.hidden = showAll || list.length <= S.worksPerPage;
    reveal.scan(grid);
  };
  viewAll.addEventListener('click', () => { showAll = true; renderWorks(); });

  /* ---------- 라이트박스 ---------- */
  const lb = $('#lightbox');
  const openLightbox = w => {
    if (!w.img) { openModal('quote'); return; }
    $('#lbImg').src = w.img; $('#lbImg').alt = w.name; $('#lbName').textContent = w.name; $('#lbCat').textContent = w.cat;
    lb.hidden = false; lock('lb', true); $('.x-btn', lb).focus();
  };
  const closeLightbox = () => { lb.hidden = true; lock('lb', false); };
  $$('[data-lb-close]', lb).forEach(b => b.addEventListener('click', closeLightbox));

  /* ---------- 스크롤 등장 모션 ---------- */
  const reveal = (() => {
    if (!motion || !('IntersectionObserver' in window)) return { scan() {} };
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in'); io.unobserve(e.target);
    }), { threshold: 0.15 });
    return {
      scan(scope = document) {
        $$('[data-reveal]:not([data-rv])', scope).forEach(e => {
          e.setAttribute('data-rv', '');
          const sib = [...e.parentElement.children].filter(c => c.hasAttribute('data-reveal'));
          e.style.setProperty('--d', Math.min(sib.indexOf(e), 6) * 90 + 'ms');
          io.observe(e);
        });
      }
    };
  })();
  addEventListener('beforeprint', () => $$('[data-reveal]').forEach(e => e.classList.add('is-in')));
  renderWorks();
  reveal.scan();

  /* ---------- 문의 모달 ---------- */
  const modal = $('#modal'), form = $('#form'), sent = $('#sent'), err = $('#formErr'), submitBtn = $('#submitBtn');
  const picks = { type: [], budget: null, schedule: null };
  const chipSrc = { type: S.form.types, budget: S.form.budgets, schedule: S.form.schedules };
  $$('[data-chips]', form).forEach(box => {
    const key = box.dataset.chips, multi = box.hasAttribute('data-multi');
    chipSrc[key].forEach(label => {
      const b = el('button', 'chip chip--blue', esc(label)); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        if (multi) picks[key] = picks[key].includes(label) ? picks[key].filter(x => x !== label) : [...picks[key], label];
        else picks[key] = picks[key] === label ? null : label;
        paintChips();
      });
      box.appendChild(b);
    });
  });
  const paintChips = () => $$('[data-chips]', form).forEach(box => {
    const v = picks[box.dataset.chips];
    $$('.chip', box).forEach(b => { const on = Array.isArray(v) ? v.includes(b.textContent) : v === b.textContent; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
  });

  let tab = 'quote', lastFocus = null;
  const setTab = t => {
    tab = t; modal.dataset.tab = t;
    $$('[data-tab]', modal).forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
    // 숨겨진 필드는 검증/전송 대상에서 제외
    $$('.q-only input, .e-only input', form).forEach(i => { i.disabled = !!i.closest(t === 'email' ? '.q-only' : '.e-only'); });
    form.msg.placeholder = t === 'email' ? '문의하실 내용을 적어주세요.' : '프로젝트 목적, 필요한 페이지, 참고할 점을 자유롭게 적어주세요.';
    submitBtn.textContent = t === 'email' ? '메일 보내기' : '견적 요청하기';
    sent.hidden = true; form.hidden = false; err.hidden = true;
  };
  const openModal = t => {
    setMenu(false);
    lastFocus = document.activeElement;
    setTab(t);
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); lock('modal', true);
    setTimeout(() => form.elements.name.focus({ preventScroll: true }), 50);
  };
  const closeModal = () => {
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); lock('modal', false);
    lastFocus?.focus?.({ preventScroll: true });
  };
  $$('[data-open]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openModal(a.dataset.open); }));
  $$('[data-close]', modal).forEach(b => b.addEventListener('click', closeModal));
  $$('[data-tab]', modal).forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  // 포커스 가두기
  modal.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = $$('button:not([disabled]), input:not([disabled]):not(.hp), textarea, a[href]', modal).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  });

  form.addEventListener('input', e => e.target.classList.remove('is-invalid'));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form._gotcha.value) return; // bot
    const bad = $$('input:not([disabled]), textarea', form).filter(i => !i.checkValidity());
    $$('.is-invalid', form).forEach(i => i.classList.remove('is-invalid'));
    if (bad.length) {
      bad.forEach(i => i.type !== 'checkbox' && i.classList.add('is-invalid'));
      err.textContent = bad[0].type === 'checkbox' ? '개인정보 수집·이용에 동의해 주세요.' : '필수 항목을 올바르게 입력해 주세요.';
      err.hidden = false; bad[0].focus(); return;
    }
    err.hidden = true;
    const fd = new FormData(form);
    const data = { 문의구분: tab === 'email' ? '이메일 문의' : '견적 문의' };
    if (tab === 'quote') Object.assign(data, { 문의유형: picks.type.join(', ') || '-', 예상예산: picks.budget || '-', 희망오픈시기: picks.schedule || '-' });
    const labels = { name: '담당자명', company: '회사명', phone: '연락처', email: '이메일', ref: '참고사이트', subject: '제목', msg: '문의내용' };
    for (const [k, v] of fd) if (labels[k]) data[labels[k]] = v || '-';
    const subject = tab === 'email' ? `[IUX.STUDIO 문의] ${data.제목}` : `[IUX.STUDIO 견적문의] ${data.회사명 !== '-' ? data.회사명 : data.담당자명}`;

    submitBtn.disabled = true;
    try {
      if (window.IUXCloud?.ready) {
        const v = k => (fd.get(k) || '').toString();
        await IUXCloud.sendInquiry({
          kind: tab, name: v('name'), company: v('company'), phone: v('phone'), email: v('email'),
          subject: v('subject'), message: v('msg'), ref: v('ref'),
          types: tab === 'quote' ? picks.type : [], budget: tab === 'quote' ? picks.budget || '' : '', schedule: tab === 'quote' ? picks.schedule || '' : ''
        });
        $('#sentMsg').textContent = '영업일 기준 1일 이내에 담당자가 연락드립니다.';
      } else if (S.web3formsKey) {
        const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ access_key: S.web3formsKey, subject, from_name: 'IUX.STUDIO 홈페이지', replyto: data.이메일, ...data }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) throw new Error(j.message || r.status);
        $('#sentMsg').textContent = '영업일 기준 1일 이내에 담당자가 연락드립니다.';
      } else if (S.formEndpoint) {
        const r = await fetch(S.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ _subject: subject, _replyto: data.이메일, ...data }) });
        if (!r.ok) throw new Error(r.status);
        $('#sentMsg').textContent = '영업일 기준 1일 이내에 담당자가 연락드립니다.';
      } else {
        const body = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
        location.href = `mailto:${C.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        $('#sentMsg').textContent = '메일 앱에서 작성된 내용을 확인 후 전송해 주세요. 영업일 기준 1일 이내에 담당자가 연락드립니다.';
      }
      form.reset(); picks.type = []; picks.budget = picks.schedule = null; paintChips();
      form.hidden = true; sent.hidden = false;
    } catch (x) {
      (x.fields || []).forEach(f => form.elements[f === 'message' ? 'msg' : f]?.classList.add('is-invalid'));
      err.textContent = x.code && x.code !== 'save_failed' ? x.message : `전송에 실패했습니다. 잠시 후 다시 시도하시거나 ${C.email} 로 메일 주세요.`;
      err.hidden = false;
    } finally { submitBtn.disabled = false; }
  });

  /* ---------- 최근 공지 ---------- */
  // content.js 의 homeNotice · homeFaq 가 false 면 메인에 표시하지 않습니다.
  if (S.homeNotice !== false && window.IUXCloud?.ready) {
    IUXCloud.listPosts('notice', { size: 3 }).then(({ items }) => {
      if (!items.length) return;
      $('#newsList').innerHTML = items.map(p => `<li><a href="notice.html?id=${p.id}">
        <span class="news__date">${p.created_at.slice(0, 10).replace(/-/g, '.')}</span>
        <span class="news__t">${p.pinned ? '<em>공지</em>' : ''}${esc(p.title)}</span>
        <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></a></li>`).join('');
      $('#news').hidden = false;
    }).catch(() => {});
  }

  /* ---------- 자주 묻는 질문 ---------- */
  if (S.homeFaq !== false && window.IUXCloud?.ready) {
    IUXCloud.listPosts('faq', { size: 5, full: true, oldestFirst: true }).then(({ items }) => {
      if (!items.length) return;
      $('#faqList').innerHTML = items.map(x => `<li><details>
        <summary><span class="faq__q">Q</span><span class="faq__t">${esc(x.title)}</span><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></summary>
        <div class="faq__a"><span class="faq__q faq__q--a">A</span><div class="md">${IUXCloud.md(x.body)}</div></div>
      </details></li>`).join('');
      $('#faq').hidden = false;
    }).catch(() => {});
  }

  /* ---------- 공지 팝업 ---------- */
  const pop = $('#pop');
  const today = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
  let hidden = ''; try { hidden = localStorage.getItem('iux-pop-hide') || ''; } catch (_) {}
  let live = S.popups.filter(p => p.on && (!p.from || p.from <= today) && (!p.to || p.to >= today) && !hidden.split(',').includes(today + ':' + p.key));
  const roll = S.popupRoll.on && live.length > 1;
  let pi = 0, popTimer;
  const paintPop = () => {
    const p = live[pi];
    pop.dataset.pos = p.pos || 'center';
    const card = $('.pop__card', pop);
    if (p.pos === 'custom') { card.style.cssText = `position:absolute;left:${p.x ?? 50}%;top:${p.y ?? 50}%;transform:translate(-${p.x ?? 50}%,-${p.y ?? 50}%)`; } else card.style.cssText = '';
    $('#popImg').src = p.img || ''; $('.pop__img', pop).hidden = !p.img;
    $('#popTitle').textContent = p.title; $('#popText').textContent = p.body;
    const btn = $('#popBtn'); btn.hidden = !p.btn; btn.textContent = p.btn || ''; btn.href = p.link || '#';
    $('#popHide').hidden = !p.hideToday;
    $('#popRoll').hidden = !roll;
    if (roll) {
      $('#popDots').innerHTML = live.map((_, k) => `<button type="button" aria-label="${k + 1}번 팝업" class="${k === pi ? 'is-on' : ''}" data-k="${k}"></button>`).join('');
      $('#popCount').textContent = `${pi + 1} / ${live.length}`;
    }
  };
  const popGo = k => { pi = (k + live.length) % live.length; paintPop(); clearInterval(popTimer); popTimer = setInterval(() => popGo(pi + 1), (S.popupRoll.sec || 5) * 1000); };
  const closePop = () => { pop.hidden = true; clearInterval(popTimer); lock('pop', false); };
  if (live.length) {
    paintPop(); pop.hidden = false; lock('pop', true);
    if (roll) popGo(0);
    $('#popDots').addEventListener('click', e => { const k = e.target.dataset.k; if (k != null) popGo(+k); });
    $$('[data-pop]', pop).forEach(b => b.addEventListener('click', () => popGo(pi + (b.dataset.pop === 'next' ? 1 : -1))));
    $('#popClose').addEventListener('click', closePop);
    pop.addEventListener('click', e => { if (e.target === pop) closePop(); });
    $('#popHide').addEventListener('click', () => {
      const ks = roll ? live.map(p => p.key) : [live[pi].key];
      try { localStorage.setItem('iux-pop-hide', ks.map(k => today + ':' + k).join(',')); } catch (_) {}
      closePop();
    });
    $('#popBtn').addEventListener('click', e => {
      closePop();
      if ($('#popBtn').getAttribute('href') === '#contact') { e.preventDefault(); openModal('quote'); }
    });
  }

  /* ---------- ESC ---------- */
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!lb.hidden) closeLightbox();
    else if (modal.classList.contains('is-open')) closeModal();
    else if (!pop.hidden) closePop();
    else if (root.classList.contains('menu-open')) setMenu(false);
  });
})();
