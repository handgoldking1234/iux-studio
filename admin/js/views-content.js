/* 콘텐츠 관리 (메인 · 서브 페이지 · 팝업) · SEO 관리 */
(() => {
  'use strict';
  const { $, $$, esc, I, S } = A;
  const V = A.views;
  const WORK_CATS = ['기업', '브랜드', '병원', '쇼핑몰', '랜딩'];
  const POS = [['center', '가운데'], ['bl', '왼쪽 아래'], ['br', '오른쪽 아래'], ['custom', '직접 지정']];
  const today = () => A.ymd(new Date());
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* 편집 상태 (저장 전까지 draft 에만 반영) */
  const E = { site: null, saved: null, draft: null, sec: 'main', mode: 'visual', slide: 0, page: null, pop: null };
  const dirty = () => JSON.stringify(E.saved) !== JSON.stringify(E.draft);
  const norm = c => ({ hero: [], works: [], company: {}, popups: [], popRoll: { on: false, sec: 5 }, pages: [], ...(c || {}) });

  V['site:content'] = async main => {
    const { data, error } = await A.sb.from('sites').select('id,content').eq('id', S.siteId).single();
    if (error) throw error;
    if (E.site !== S.siteId || !E.draft || !dirty()) { E.site = S.siteId; E.saved = norm(data.content); E.draft = A.clone(E.saved); E.slide = 0; E.page = null; E.pop = null; }
    main.innerHTML = `${A.siteHead('콘텐츠 관리')}
      <div class="savebar" id="sb"><span id="sbMsg"></span><div class="row"><button class="btn btn--line btn--sm" id="reset">초기화</button><button class="btn btn--primary btn--sm" id="save">저장</button></div></div>
      <div class="row row--sb" style="margin-bottom:20px"><div class="chips" id="secs">${[['main', '메인 페이지'], ['sub', '서브 페이지'], ['pop', '팝업']].map(([k, l]) => `<button class="chip${E.sec === k ? ' is-on' : ''}" data-sec="${k}">${l}</button>`).join('')}</div>
        <a class="btn btn--line btn--sm" href="${esc(siteUrl())}" target="_blank" rel="noopener">${I('ext', 'i--sm')}홈페이지 보기</a></div>
      <div id="ce"></div>`;
    A.bindHead(main);
    $('#secs').onclick = e => { const b = e.target.closest('[data-sec]'); if (!b) return; E.sec = b.dataset.sec; $$('#secs .chip').forEach(x => x.classList.toggle('is-on', x === b)); paint(); };
    $('#reset').onclick = () => { if (!dirty() || A.confirm('저장하지 않은 변경사항을 되돌릴까요?')) { E.draft = A.clone(E.saved); paint(); } };
    $('#save').onclick = save;
    paint();
  };
  const siteUrl = (q = '') => {
    const s = A.site(); if (!s?.domain) return '#';
    return 'https://' + s.domain.replace(/\/+$/, '') + '/' + q;
  };
  const mark = () => { const d = dirty(); $('#sb')?.classList.toggle('is-dirty', d); const m = $('#sbMsg'); if (m) m.textContent = d ? '저장하지 않은 변경사항이 있습니다.' : '내용을 수정한 뒤 저장하세요. 이미지는 칸에 끌어다 놓으면 바로 올라갑니다.'; };
  async function save() {
    const pages = E.draft.pages, slugs = pages.map(p => p.slug);
    const dup = slugs.find((s, i) => slugs.indexOf(s) !== i); if (dup) return A.toast(`주소가 겹칩니다: ${dup}`, true);
    const bad = pages.find(p => !/^\/[a-z0-9\-/]*$/.test(p.slug)); if (bad) return A.toast(`주소는 영문 소문자 · 숫자 · - 만 쓸 수 있습니다: ${bad.slug}`, true);
    $('#save').disabled = true;
    const { error } = await A.sb.from('sites').update({ content: E.draft }).eq('id', S.siteId);
    $('#save').disabled = false;
    if (error) return A.fail(error, '저장하지 못했습니다.');
    E.saved = A.clone(E.draft); mark(); A.toast('저장했습니다. 홈페이지에 바로 반영됩니다.');
  }
  addEventListener('beforeunload', e => { if (S.tab === 'content' && E.draft && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  function paint() {
    const box = $('#ce'); if (!box) return;
    if (E.sec === 'main') paintMain(box); else if (E.sec === 'sub') paintSub(box); else paintPop(box);
    mark();
  }
  const set = (fn) => { fn(E.draft); mark(); };

  /* ---------- 메인 페이지 ---------- */
  function paintMain(box) {
    const d = E.draft;
    if (!d.hero.length) d.hero.push({ cat: '', title: '', desc: '', img: '' });
    E.slide = Math.min(E.slide, d.hero.length - 1);
    box.innerHTML = `<div class="row row--sb" style="margin-bottom:16px"><div class="seg">${[['visual', '화면에서 편집'], ['form', '입력 폼']].map(([k, l]) => `<button data-mode="${k}" class="${E.mode === k ? 'is-on' : ''}">${l}</button>`).join('')}</div>
      <span class="muted" style="font-size:13px">${E.mode === 'visual' ? '글자를 클릭해 바로 고치고, 이미지는 끌어다 놓아 바꾸세요.' : '항목별로 입력해 수정합니다.'}</span></div>
      <div id="mainEd"></div>
      <div class="card card__pad" style="margin-top:24px"><div class="card__h"><h2>회사 정보 (푸터)</h2></div><div class="grid g4" id="co">
        ${[['name', '회사명', 'IUX.studio'], ['ceo', '대표자', '홍길동'], ['bizNo', '사업자등록번호', '000-00-00000'], ['tel', '대표 전화', '02-000-0000'], ['email', '이메일', 'hello@example.com'], ['address', '주소', '서울시 …']].map(([k, l, ph]) => `<label class="field">${l}<input data-co="${k}" value="${esc(d.company[k] || '')}" placeholder="${ph}"></label>`).join('')}</div></div>`;
    box.querySelector('.seg').onclick = e => { const b = e.target.closest('[data-mode]'); if (b) { E.mode = b.dataset.mode; paintMain(box); } };
    $('#co').oninput = e => { const k = e.target.dataset.co; if (k) set(d => { d.company[k] = e.target.value; }); };
    (E.mode === 'visual' ? visual : form)($('#mainEd'));
  }
  function visual(el) {
    const d = E.draft, h = d.hero[E.slide];
    el.innerHTML = `<div class="preview"><div class="preview__bar"><i></i><i></i><i></i><span>${esc(siteUrl() === '#' ? 'https://example.com' : siteUrl())}</span></div>
      <div class="vhero">${A.dropHTML(h.img, '배경 이미지를 끌어다 놓기')}
        <div class="vhero__copy"><p class="vhero__cat" contenteditable="plaintext-only" data-f="cat">${esc(h.cat)}</p><h2 class="vhero__title" contenteditable="plaintext-only" data-f="title">${esc(h.title)}</h2><p class="vhero__desc" contenteditable="plaintext-only" data-f="desc">${esc(h.desc)}</p></div>
        <div class="vhero__dots">${d.hero.map((_, i) => `<button data-s="${i}" class="${i === E.slide ? 'is-on' : ''}">${i + 1}</button>`).join('')}<button data-add title="슬라이드 추가">+</button></div></div>
      <div class="vsec"><div class="row row--sb" style="margin-bottom:20px"><h3 style="margin:0">포트폴리오</h3><button class="btn btn--sm" data-wadd style="background:#1f1f1f;color:#fff">항목 추가</button></div>
        <div class="grid g4">${d.works.map((w, i) => `<div class="vwork" data-w="${i}">${A.dropHTML(w.img, '이미지 끌어다 놓기')}<div class="row"><span contenteditable="plaintext-only" data-wn>${esc(w.name)}</span><select data-wc>${WORK_CATS.map(c => `<option${c === w.cat ? ' selected' : ''}>${c}</option>`).join('')}</select></div></div>`).join('')}</div>
        ${d.works.length ? '' : '<p class="muted" style="font-size:13px">항목 추가로 작업물을 넣어보세요.</p>'}</div></div>`;
    const heroDrop = el.querySelector('.vhero .drop');
    A.bindDrop(heroDrop, url => { set(d => { d.hero[E.slide].img = url; }); visual(el); });
    el.querySelectorAll('.vhero [data-f]').forEach(n => n.addEventListener('input', () => set(d => { d.hero[E.slide][n.dataset.f] = n.innerText.replace(/\n{3,}/g, '\n\n').trim(); })));
    el.querySelector('.vhero__dots').onclick = e => {
      const s = e.target.closest('[data-s]'); if (s) { E.slide = +s.dataset.s; visual(el); }
      if (e.target.closest('[data-add]')) { set(d => d.hero.push({ cat: '카테고리', title: '새 슬라이드 제목', desc: '설명을 입력하세요.', img: '' })); E.slide = d.hero.length - 1; visual(el); }
    };
    el.querySelector('[data-wadd]').onclick = () => { set(d => d.works.push({ name: '새 프로젝트', cat: '기업', img: '', link: '' })); visual(el); };
    el.querySelectorAll('[data-w]').forEach(card => {
      const i = +card.dataset.w;
      A.bindDrop(card.querySelector('.drop'), url => { set(d => { d.works[i].img = url; }); visual(el); });
      card.querySelector('.drop').addEventListener('click', e => { if (e.target.closest('[data-drop-x]') && !E.draft.works[i].img) { e.stopPropagation(); } }, true);
      card.querySelector('[data-wn]').addEventListener('input', e => set(d => { d.works[i].name = e.target.innerText.trim(); }));
      card.querySelector('[data-wc]').addEventListener('change', e => set(d => { d.works[i].cat = e.target.value; }));
    });
    // 비주얼 모드에서 이미지 없는 카드의 ✕ = 항목 삭제
    el.querySelectorAll('[data-w] .drop').forEach(dp => { if (!dp.querySelector('img')) { const x = document.createElement('button'); x.type = 'button'; x.className = 'drop__x'; x.textContent = '✕'; x.title = '항목 삭제'; x.onclick = ev => { ev.stopPropagation(); const i = +dp.closest('[data-w]').dataset.w; set(d => d.works.splice(i, 1)); visual(el); }; dp.appendChild(x); } });
  }
  function form(el) {
    const d = E.draft;
    el.innerHTML = `<div class="card card__pad" style="margin-bottom:24px"><div class="card__h"><h2>히어로 슬라이드</h2><button class="btn btn--line btn--sm" data-hadd>슬라이드 추가</button></div>
      <div class="grid g3" style="gap:16px">${d.hero.map((h, i) => `<div class="slidecard" data-h="${i}">${A.dropHTML(h.img, '슬라이드 이미지를 끌어다 놓기')}
        <label class="field">카테고리<input data-f="cat" value="${esc(h.cat)}"></label><label class="field">제목<textarea data-f="title" rows="2">${esc(h.title)}</textarea></label><label class="field">설명<textarea data-f="desc" rows="3">${esc(h.desc)}</textarea></label>
        ${d.hero.length > 1 ? `<button class="btn btn--danger btn--xs" data-hdel style="align-self:flex-end">슬라이드 삭제</button>` : ''}</div>`).join('')}</div></div>
      <div class="card card__pad"><div class="card__h"><h2>포트폴리오</h2><button class="btn btn--line btn--sm" data-wadd>항목 추가</button></div>
      <div class="grid g4" style="gap:16px">${d.works.map((w, i) => `<div class="workcard" data-w="${i}">${A.dropHTML(w.img, '이미지 끌어다 놓기')}<input class="inp" data-f="name" value="${esc(w.name)}" placeholder="프로젝트명"><input class="inp" data-f="link" value="${esc(w.link || '')}" placeholder="사이트 주소 (선택)">
        <div class="row"><select class="inp" data-f="cat">${WORK_CATS.map(c => `<option${c === w.cat ? ' selected' : ''}>${c}</option>`).join('')}</select><button class="btn btn--danger btn--sm" data-wdel>삭제</button></div></div>`).join('')}</div>
      ${d.works.length ? '' : '<p class="empty">항목 추가로 작업물을 넣어보세요.</p>'}</div>`;
    el.querySelector('[data-hadd]').onclick = () => { set(d => d.hero.push({ cat: '', title: '', desc: '', img: '' })); form(el); };
    el.querySelector('[data-wadd]').onclick = () => { set(d => d.works.push({ name: '새 프로젝트', cat: '기업', img: '', link: '' })); form(el); };
    el.querySelectorAll('[data-h]').forEach(c => {
      const i = +c.dataset.h;
      A.bindDrop(c.querySelector('.drop'), url => { set(d => { d.hero[i].img = url; }); form(el); });
      c.addEventListener('input', e => { const f = e.target.dataset.f; if (f) set(d => { d.hero[i][f] = e.target.value; }); });
      c.querySelector('[data-hdel]')?.addEventListener('click', () => { set(d => d.hero.splice(i, 1)); E.slide = 0; form(el); });
    });
    el.querySelectorAll('[data-w]').forEach(c => {
      const i = +c.dataset.w;
      A.bindDrop(c.querySelector('.drop'), url => { set(d => { d.works[i].img = url; }); form(el); });
      c.addEventListener('input', e => { const f = e.target.dataset.f; if (f) set(d => { d.works[i][f] = e.target.value; }); });
      c.addEventListener('change', e => { const f = e.target.dataset.f; if (f) set(d => { d.works[i][f] = e.target.value; }); });
      c.querySelector('[data-wdel]').onclick = () => { set(d => d.works.splice(i, 1)); form(el); };
    });
  }

  /* ---------- 서브 페이지 ---------- */
  const depth = (p, pages) => { let n = 0, cur = p; while (cur?.parent) { cur = pages.find(x => x.id === cur.parent); n++; } return n; };
  const ordered = pages => { const out = []; const walk = (parent, lv) => pages.filter(p => (p.parent || null) === parent).forEach(p => { out.push({ p, lv }); walk(p.id, lv + 1); }); walk(null, 0); return out; };
  function paintSub(box) {
    const d = E.draft, pages = d.pages;
    if (!E.page || !pages.some(p => p.id === E.page)) E.page = pages[0]?.id || null;
    const pg = pages.find(p => p.id === E.page);
    const desc = id => { const ids = [id]; pages.forEach(p => { if (ids.includes(p.parent)) ids.push(p.id); }); return ids; };
    box.innerHTML = `<div class="g-12" style="grid-template-columns:280px minmax(0,1fr)">
      <div><div class="tree" id="tree">${ordered(pages).map(({ p, lv }) => `<div class="row" style="flex-wrap:nowrap;gap:4px"><button class="tree__it lv${lv}${p.id === E.page ? ' is-on' : ''}" data-p="${p.id}"><span><b>${esc(p.name || '이름 없음')}</b><small>${esc(p.slug)}</small></span></button>${lv < 2 ? `<button class="tree__add" data-child="${p.id}" title="하위 메뉴 추가">+</button>` : '<span style="width:22px"></span>'}<span class="tag${p.on ? '' : ' tag--off'}">${p.on ? '공개' : '숨김'}</span></div>`).join('') || '<p class="muted" style="padding:12px;font-size:13px">아직 서브 페이지가 없습니다.</p>'}
        <button class="btn btn--line btn--block" style="height:40px;border-radius:6px;margin-top:8px" data-top>+ 1차 메뉴 추가</button></div>
        <p class="muted" style="font-size:12px;margin-top:10px;text-align:center">메뉴 옆 + 로 하위 메뉴를 만듭니다 (최대 3차).</p></div>
      ${pg ? `<div class="card card__pad stack" id="pe" style="gap:18px">
        <div class="row row--sb"><h2 style="font-size:20px;font-weight:800">${esc(pg.name || '이름 없음')}</h2><div class="row"><label class="check"><input type="checkbox" data-f="on"${pg.on ? ' checked' : ''}>메뉴에 공개</label><a class="btn btn--line btn--xs" href="${esc(siteUrl('page.html?p=' + encodeURIComponent(pg.slug)))}" target="_blank" rel="noopener">보기</a><button class="btn btn--danger btn--xs" data-del>페이지 삭제</button></div></div>
        <div class="grid g3"><label class="field">상위 메뉴<select data-f="parent"><option value="">없음 (1차 메뉴)</option>${pages.filter(x => !desc(pg.id).includes(x.id) && depth(x, pages) < 2).map(x => `<option value="${x.id}"${x.id === pg.parent ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
          <label class="field">메뉴 이름<input data-f="name" value="${esc(pg.name)}"></label>
          <label class="field">주소<div class="inp--pre">/<input data-f="slug" value="${esc(pg.slug.replace(/^\//, ''))}" placeholder="about"></div></label></div>
        <div class="field">상단 이미지<div id="banner">${A.dropHTML(pg.banner, '상단 배너 이미지를 끌어다 놓기', '')}</div></div>
        <label class="field">페이지 제목<input data-f="title" value="${esc(pg.title || '')}" style="font-size:17px;font-weight:700"></label>
        <label class="field">소개 문구<textarea data-f="intro" rows="2">${esc(pg.intro || '')}</textarea></label>
        <div class="field"><div class="row row--sb">본문 블록<button class="btn btn--xs" data-badd>+ 블록 추가</button></div>
          <div class="stack" style="gap:10px" id="blocks">${(pg.blocks || []).map((b, i) => `<div class="block" data-b="${i}"><b>${i + 1}</b><div class="stack" style="gap:8px"><input class="inp" data-bf="t" value="${esc(b.t)}" placeholder="블록 제목" style="font-weight:700"><textarea class="inp" data-bf="b" rows="3" placeholder="내용">${esc(b.b)}</textarea></div><div class="stack" style="gap:4px"><button class="iconbtn" data-bup title="위로" ${i ? '' : 'disabled'}>${I('up', 'i--sm')}</button><button class="iconbtn" data-bdel title="삭제" style="color:var(--neg)">${I('x', 'i--sm')}</button></div></div>`).join('') || '<p class="muted" style="font-size:13px">블록 추가로 본문을 만들어보세요.</p>'}</div></div>
      </div>` : `<div class="card empty">왼쪽에서 <b>+ 1차 메뉴 추가</b>로 회사 소개, 서비스 같은 페이지를 만들어보세요.<br>공개한 페이지는 홈페이지 상단 메뉴에 자동으로 추가됩니다.</div>`}</div>`;
    const add = parent => { const n = pages.length + 1, p = { id: uid(), parent: parent || null, name: parent ? '새 하위 메뉴' : '새 메뉴', slug: (parent ? pages.find(x => x.id === parent).slug : '') + '/page-' + n, on: false, banner: '', title: '', intro: '', blocks: [] }; set(d => d.pages.push(p)); E.page = p.id; paintSub(box); };
    box.querySelector('[data-top]').onclick = () => add(null);
    $('#tree').onclick = e => { const c = e.target.closest('[data-child]'), p = e.target.closest('[data-p]'); if (c) add(c.dataset.child); else if (p) { E.page = p.dataset.p; paintSub(box); } };
    if (!pg) return;
    const pe = $('#pe');
    pe.addEventListener('input', e => {
      const f = e.target.dataset.f; if (!f || f === 'on' || f === 'parent') return;
      set(() => { pg[f] = f === 'slug' ? '/' + e.target.value.toLowerCase().replace(/[^a-z0-9\-/]/g, '').replace(/^\/+/, '') : e.target.value; });
      if (f === 'name' || f === 'slug') { const it = $(`[data-p="${pg.id}"]`); if (it) it.querySelector(f === 'name' ? 'b' : 'small').textContent = f === 'name' ? pg.name : pg.slug; }
    });
    pe.addEventListener('change', e => { const f = e.target.dataset.f; if (f === 'on') { set(() => { pg.on = e.target.checked; }); paintSub(box); } if (f === 'parent') { set(() => { pg.parent = e.target.value || null; }); paintSub(box); } });
    pe.querySelector('[data-del]').onclick = () => { if (!A.confirm(`'${pg.name}' 페이지${pages.some(x => x.parent === pg.id) ? '와 하위 메뉴' : ''}를 삭제할까요?`)) return; const ids = desc(pg.id); set(d => { d.pages = d.pages.filter(x => !ids.includes(x.id)); }); E.page = null; paintSub(box); };
    A.bindDrop($('#banner .drop'), url => { set(() => { pg.banner = url; }); paintSub(box); });
    $('#banner .drop').style.aspectRatio = '16/5';
    pe.querySelector('[data-badd]').onclick = () => { set(() => { (pg.blocks = pg.blocks || []).push({ t: '', b: '' }); }); paintSub(box); };
    $('#blocks').addEventListener('input', e => { const b = e.target.closest('[data-b]'), f = e.target.dataset.bf; if (b && f) set(() => { pg.blocks[+b.dataset.b][f] = e.target.value; }); });
    $('#blocks').addEventListener('click', e => {
      const b = e.target.closest('[data-b]'); if (!b) return; const i = +b.dataset.b;
      if (e.target.closest('[data-bdel]')) { set(() => pg.blocks.splice(i, 1)); paintSub(box); }
      if (e.target.closest('[data-bup]') && i) { set(() => { const t = pg.blocks[i - 1]; pg.blocks[i - 1] = pg.blocks[i]; pg.blocks[i] = t; }); paintSub(box); }
    });
  }

  /* ---------- 팝업 ---------- */
  const popState = p => !p.on ? ['꺼짐', 'tag--off'] : p.to && p.to < today() ? ['기간 지남', 'tag--off'] : p.from && p.from > today() ? ['예약', ''] : ['게시중', ''];
  function paintPop(box) {
    const d = E.draft, list = d.popups;
    if (!E.pop || !list.some(p => p.id === E.pop)) E.pop = list[0]?.id || null;
    const p = list.find(x => x.id === E.pop);
    box.innerHTML = `<div class="card card__pad" style="margin-bottom:16px;padding:18px 20px"><div class="row" style="gap:14px"><button class="switch${d.popRoll.on ? ' is-on' : ''}" data-roll aria-label="팝업 롤링"></button><div class="grow"><b>팝업 롤링</b><p class="muted" style="font-size:12px;margin-top:2px">${d.popRoll.on ? '게시중인 팝업을 번갈아 보여줍니다.' : '게시중인 팝업 중 첫 번째만 보여줍니다.'}</p></div>${d.popRoll.on ? `<label class="row" style="font-size:13px;font-weight:700">넘김 간격<input class="inp" type="number" min="2" max="30" data-sec value="${d.popRoll.sec || 5}" style="width:72px">초</label>` : ''}</div></div>
      <div class="grid g4" style="margin-bottom:24px">${list.map(x => { const [t, c] = popState(x); return `<button class="popcard${x.id === E.pop ? ' is-on' : ''}" data-p="${x.id}"><b>${esc(x.name || '팝업')}<span class="tag ${c}">${t}</span></b><small>${A.dot(x.from)} ~ ${x.to ? A.dot(x.to) : '종료일 없음'}</small></button>`; }).join('')}<button class="popcard popcard--add" data-add>+ 팝업 추가</button></div>
      ${p ? `<div class="g-12"><div class="card card__pad stack" id="pf" style="gap:18px">
        <div class="row row--sb"><h2 style="font-size:20px;font-weight:800">팝업 설정</h2><div class="row"><label class="check"><input type="checkbox" data-f="on"${p.on ? ' checked' : ''}>게시</label><button class="btn btn--danger btn--xs" data-del>삭제</button></div></div>
        <label class="field">관리용 이름<input data-f="name" value="${esc(p.name || '')}"></label>
        <div class="grid g2"><label class="field">시작일<input type="date" data-f="from" value="${esc(p.from || '')}"></label><label class="field">종료일<input type="date" data-f="to" value="${esc(p.to || '')}"></label></div>
        <div class="field">위치<div class="chips" id="pos">${POS.map(([k, l]) => `<button type="button" class="chip chip--blue${(p.pos || 'center') === k ? ' is-on' : ''}" data-pos="${k}">${l}</button>`).join('')}</div>
          ${p.pos === 'custom' ? `<div class="grid g2"><label class="field">가로 위치 <small>${p.x ?? 50}%</small><input type="range" min="0" max="100" data-f="x" value="${p.x ?? 50}"></label><label class="field">세로 위치 <small>${p.y ?? 50}%</small><input type="range" min="0" max="100" data-f="y" value="${p.y ?? 50}"></label></div>` : ''}</div>
        <div class="field">이미지<div id="pimg">${A.dropHTML(p.img, '팝업 이미지를 끌어다 놓기 (선택)')}</div></div>
        <label class="field">제목<input data-f="title" value="${esc(p.title || '')}"></label>
        <label class="field">내용<textarea data-f="body" rows="3">${esc(p.body || '')}</textarea></label>
        <div class="grid g2"><label class="field">버튼 문구<input data-f="btn" value="${esc(p.btn || '')}" placeholder="비우면 버튼 없음"></label><label class="field">버튼 링크<input data-f="link" value="${esc(p.link || '')}" placeholder="#contact"></label></div>
        <label class="check"><input type="checkbox" data-f="hideToday"${p.hideToday ? ' checked' : ''}>'오늘 하루 보지 않기' 표시</label>
      </div><div class="card card__pad" style="position:sticky;top:160px"><div class="card__h"><h2>미리보기</h2><small id="pvState">${popState(p)[0]}</small></div><div id="pv"></div></div></div>` : `<div class="card empty">+ 팝업 추가로 이벤트 · 공지 팝업을 만들어보세요.</div>`}`;
    box.querySelector('[data-roll]').onclick = () => { set(d => { d.popRoll.on = !d.popRoll.on; }); paintPop(box); };
    box.querySelector('[data-sec]')?.addEventListener('input', e => set(d => { d.popRoll.sec = Math.max(2, +e.target.value || 5); }));
    box.querySelector('[data-add]').onclick = () => { const n = { id: uid(), name: '새 팝업', on: false, from: today(), to: '', pos: 'center', img: '', title: '팝업 제목', body: '', btn: '', link: '#contact', hideToday: true }; set(d => d.popups.push(n)); E.pop = n.id; paintPop(box); };
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { E.pop = b.dataset.p; paintPop(box); });
    if (!p) return;
    const pv = () => { $('#pv').innerHTML = `<div class="popprev" data-pos="${p.pos === 'custom' ? 'center' : p.pos || 'center'}"><div class="popprev__card"${p.pos === 'custom' ? ` style="position:absolute;left:${p.x ?? 50}%;top:${p.y ?? 50}%;transform:translate(-${p.x ?? 50}%,-${p.y ?? 50}%);margin:0"` : ''}>
      <div class="popprev__img">${p.img ? `<img src="${esc(p.img)}" alt="">` : '이미지'}</div><div class="popprev__b"><b>${esc(p.title || '')}</b>${p.body ? `<p>${esc(p.body)}</p>` : ''}${p.btn ? `<span>${esc(p.btn)}</span>` : ''}</div>
      <div class="popprev__f"><span>${p.hideToday ? '오늘 하루 보지 않기' : ''}</span><b>닫기</b></div></div></div>`; $('#pvState').textContent = popState(p)[0]; };
    pv();
    const pf = $('#pf');
    pf.addEventListener('input', e => { const f = e.target.dataset.f; if (!f || e.target.type === 'checkbox') return; set(() => { p[f] = e.target.type === 'range' ? +e.target.value : e.target.value; }); if (e.target.type === 'range') e.target.previousElementSibling.textContent = e.target.value + '%'; pv(); if (f === 'name' || f === 'from' || f === 'to') { const c = $(`[data-p="${p.id}"]`); if (c) { const [t, cl] = popState(p); c.innerHTML = `<b>${esc(p.name || '팝업')}<span class="tag ${cl}">${t}</span></b><small>${A.dot(p.from)} ~ ${p.to ? A.dot(p.to) : '종료일 없음'}</small>`; } } });
    pf.addEventListener('change', e => { const f = e.target.dataset.f; if (e.target.type === 'checkbox' && f) { set(() => { p[f] = e.target.checked; }); if (f === 'on') paintPop(box); else pv(); } });
    $('#pos').onclick = e => { const b = e.target.closest('[data-pos]'); if (b) { set(() => { p.pos = b.dataset.pos; }); paintPop(box); } };
    pf.querySelector('[data-del]').onclick = () => { if (!A.confirm(`'${p.name}' 팝업을 삭제할까요?`)) return; set(d => { d.popups = d.popups.filter(x => x.id !== p.id); }); E.pop = null; paintPop(box); };
    A.bindDrop($('#pimg .drop'), url => { set(() => { p.img = url; }); paintPop(box); });
    $('#pimg .drop').style.aspectRatio = '4/3';
  }

  /* =============== SEO 관리 =============== */
  V['site:seo'] = async main => {
    const { data, error } = await A.sb.from('sites').select('id,name,domain,seo,content').eq('id', S.siteId).single();
    if (error) throw error;
    const seo = { pages: {}, google: '', naver: '', ga: '', sitemap: true, robots: true, https: true, ...(data.seo || {}) };
    const tabs = [['home', '메인', '/'], ['notice', '공지사항', '/notice.html'], ['faq', '자주 묻는 질문', '/faq.html'], ...((data.content?.pages || []).filter(p => p.on).map(p => ['page:' + p.slug, p.name, '/page.html?p=' + p.slug]))];
    let cur = tabs.some(t => t[0] === S.arg) ? S.arg : 'home';
    const host = (data.domain || 'example.com').replace(/\/+$/, '');
    const pg = k => (seo.pages[k] = seo.pages[k] || { title: '', desc: '', keywords: '', og: '', noindex: false });
    const checks = () => {
      const p = pg(cur), kw = (p.keywords || '').split(',')[0]?.trim();
      return [
        [p.title.length >= 10 && p.title.length <= 60, '페이지 제목', p.title ? (p.title.length > 60 ? '60자 이하로 줄여주세요.' : p.title.length < 10 ? '조금 더 구체적으로 적어주세요.' : '적절한 길이입니다.') : '제목을 입력해 주세요.'],
        [p.desc.length >= 50 && p.desc.length <= 160, '설명', p.desc ? (p.desc.length > 160 ? '160자 이하로 줄여주세요.' : p.desc.length < 50 ? '50자 이상이 좋습니다.' : '적절한 길이입니다.') : '설명을 입력해 주세요.'],
        [!!kw && p.title.includes(kw), '핵심 키워드가 제목에 포함', kw ? `첫 번째 키워드: ${kw}` : '키워드를 입력해 주세요.'],
        [!p.noindex, '검색엔진 노출', p.noindex ? '이 페이지는 검색에 나오지 않습니다.' : '이 페이지는 검색에 노출됩니다.'],
        [!!seo.google, '구글 서치콘솔 등록', '등록하면 구글 검색어 데이터를 볼 수 있습니다.'],
        [!!seo.naver, '네이버 서치어드바이저 등록', '국내 검색 유입에 중요합니다.'],
        [!!og(), 'SNS 공유 이미지', og() ? '공유할 때 이미지가 함께 보입니다.' : '1200×630 이미지를 넣어주세요.']
      ];
    };
    const og = () => pg(cur).og || pg('home').og;
    let draw = () => {
      const p = pg(cur);
      main.innerHTML = `${A.siteHead('SEO 관리')}
        <div class="card card__pad row row--sb" style="margin-bottom:24px;padding:18px 20px"><div class="score" id="score"></div><button class="btn btn--primary" id="save">저장</button></div>
        <div class="chips" style="margin-bottom:20px" id="pt">${tabs.map(([k, l]) => `<button class="chip${k === cur ? ' is-on' : ''}" data-k="${esc(k)}">${esc(l)}</button>`).join('')}</div>
        <div class="g-12" style="margin-bottom:16px">
          <div class="card card__pad stack" id="pf" style="gap:18px"><div class="card__h" style="margin:0"><h2>${esc(tabs.find(t => t[0] === cur)[1])} 페이지 설정</h2></div>
            <label class="field"><span class="field__row">페이지 제목 (title)<small id="tc">${p.title.length} / 60</small></span><input data-f="title" value="${esc(p.title)}" placeholder="${esc(data.name)} | 핵심 키워드"></label>
            <label class="field"><span class="field__row">설명 (description)<small id="dc">${p.desc.length} / 160</small></span><textarea data-f="desc" rows="3" placeholder="검색 결과에 보이는 설명">${esc(p.desc)}</textarea></label>
            <label class="field">키워드 <small>쉼표로 구분, 첫 번째가 핵심 키워드</small><input data-f="keywords" value="${esc(p.keywords)}" placeholder="홈페이지 제작, 반응형 웹"></label>
            <label class="field">페이지 주소<div class="inp--pre">${esc(host)}<input value="${esc(tabs.find(t => t[0] === cur)[2])}" readonly></div></label>
            <label class="check"><input type="checkbox" data-f="index"${p.noindex ? '' : ' checked'}>검색엔진에 노출</label></div>
          <div class="stack" style="gap:16px">
            <div class="card card__pad"><div class="card__h"><h2>검색 결과 미리보기</h2></div><div class="serp" id="serp"></div></div>
            <div class="card card__pad"><div class="card__h"><h2>SNS 공유 이미지</h2>${cur !== 'home' && !p.og && pg('home').og ? '<small>메인 이미지 사용 중</small>' : ''}</div><div class="ogcard"><div id="og">${A.dropHTML(og(), '1200 × 630 이미지를 끌어다 놓기')}</div><div class="og__t"><small>${esc(host)}</small><b id="ogt">${esc(p.title || data.name)}</b></div></div></div></div></div>
        <div class="g-12"><div class="card card__pad"><div class="card__h"><h2>점검 항목</h2></div><div class="checks" id="ck"></div></div>
          <div class="card card__pad stack" id="cf" style="gap:16px"><div class="card__h" style="margin:0"><h2>사이트 공통 · 검색엔진 등록</h2></div>
            <label class="field">구글 서치콘솔 인증 코드<input data-c="google" value="${esc(seo.google)}" placeholder="google-site-verification 값"></label>
            <label class="field">네이버 서치어드바이저 인증 코드<input data-c="naver" value="${esc(seo.naver)}" placeholder="naver-site-verification 값"></label>
            <label class="field">구글 애널리틱스 측정 ID<input data-c="ga" value="${esc(seo.ga)}" placeholder="G-XXXXXXXXXX"></label>
            ${[['sitemap', '사이트맵 사용', 'sitemap.xml 을 검색엔진에 제출합니다.'], ['robots', 'robots.txt 허용', '검색 로봇의 수집을 허용합니다.'], ['https', 'HTTPS 기본 주소', 'http 접속을 https로 넘깁니다.']].map(([k, t, s]) => `<label class="toggle-row"><span><b>${t}</b><small>${s}</small></span><input type="checkbox" class="check" data-c="${k}"${seo[k] ? ' checked' : ''} style="width:18px;height:18px;accent-color:var(--blue)"></label>`).join('')}
            <p class="muted" style="font-size:12px;line-height:1.6">인증 코드는 홈페이지에 자동으로 적용됩니다. 인증이 되지 않으면 각 서비스의 'HTML 파일 업로드' 방식을 이용하세요.</p></div></div>`;
      A.bindHead(main);
      const serp = () => { $('#serp').innerHTML = `<div class="serp__site"><i>${esc(A.initial(data.name))}</i><div>${esc(data.name)}<small>https://${esc(host)}${esc(tabs.find(t => t[0] === cur)[2] === '/' ? '' : tabs.find(t => t[0] === cur)[2])}</small></div></div><h4>${esc(p.title || data.name)}</h4><p>${esc(p.desc || '설명을 입력하면 검색 결과에 이렇게 보입니다.')}</p>`; };
      serp();
      $('#pt').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { cur = b.dataset.k; draw(); } };
      $('#pf').addEventListener('input', e => { const f = e.target.dataset.f; if (!f || f === 'index') return; p[f] = e.target.value; $('#tc').textContent = `${p.title.length} / 60`; $('#dc').textContent = `${p.desc.length} / 160`; $('#ogt').textContent = p.title || data.name; serp(); paintChecks(); });
      $('#pf').addEventListener('change', e => { if (e.target.dataset.f === 'index') { p.noindex = !e.target.checked; draw(); } });

      $('#cf').addEventListener('input', e => { const k = e.target.dataset.c; if (k) seo[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim(); });
      $('#cf').addEventListener('input', paintChecks);
      A.bindDrop($('#og .drop'), url => { p.og = url; draw(); });
      $('#save').onclick = async () => {
        if (seo.ga && !/^G-[A-Z0-9]+$/.test(seo.ga)) return A.toast('측정 ID는 G-XXXXXXXXXX 형식입니다.', true);
        Object.keys(seo.pages).forEach(k => { const x = seo.pages[k]; if (!x.title && !x.desc && !x.keywords && !x.og && !x.noindex) delete seo.pages[k]; });
        const { error } = await A.sb.from('sites').update({ seo }).eq('id', S.siteId);
        if (error) return A.fail(error); A.toast('저장했습니다. 홈페이지에 바로 반영됩니다.'); draw();
      };
    };
    function paintChecks() {
      const ck = checks(), score = Math.round(ck.filter(c => c[0]).length / ck.length * 100), todo = ck.filter(c => !c[0]).length;
      $('#score').innerHTML = `<span class="score__ring${score >= 80 ? ' is-good' : ''}">${score}</span><div><b>SEO 점수 ${score >= 80 ? '좋음' : score >= 50 ? '보통' : '개선 필요'}</b><small>${todo ? `개선할 항목 ${todo}개` : '모든 항목을 갖췄습니다'}</small></div>`;
      $('#ck').innerHTML = ck.map(([ok, t, s]) => `<div><i class="${ok ? '' : 'is-warn'}">${ok ? '✓' : '!'}</i><div><b>${esc(t)}</b><small>${esc(s)}</small></div></div>`).join('');
    }
    const draw0 = draw;
    draw = () => { draw0(); paintChecks(); };
    draw();
  };
})();
