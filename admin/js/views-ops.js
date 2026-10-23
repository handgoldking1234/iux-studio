/* 문의 관리 · 게시판 · 내 서비스 · 고객센터 */
(() => {
  'use strict';
  const { $, $$, esc, I, S } = A;
  const V = A.views;
  const PAGE = 20;

  /* =============== 문의 관리 =============== */
  const F = { st: '', q: '', page: 1, site: '' };
  const TABS = [['', '전체'], ['new', '신규'], ['progress', '상담중'], ['quote', '견적 발송'], ['contract', '계약'], ['hold', '보류'], ['done', '완료'], ['spam', '스팸']];
  const query = (sel = '*', opt = { count: 'exact' }) => {
    let q = A.sb.from('inquiries').select(sel, opt).eq('site_id', S.siteId);
    q = F.st ? q.eq('status', F.st) : q.neq('status', 'spam');
    if (F.q) { const l = '*' + F.q.replace(/[*,()%]/g, ' ').trim() + '*'; q = q.or(`name.ilike.${l},company.ilike.${l},email.ilike.${l},phone.ilike.${l},subject.ilike.${l}`); }
    return q.order('created_at', { ascending: false });
  };
  const typeOf = r => r.types?.length ? r.types.join(', ') : r.subject || A.KIND[r.kind] || '-';
  V['site:inq'] = async main => {
    if (F.site !== S.siteId) { Object.assign(F, { st: '', q: '', page: 1, site: S.siteId }); }
    main.innerHTML = `${A.siteHead('문의 관리', { extra: `<div class="row"><div class="search" style="width:260px"><input id="iq" placeholder="이름 · 회사 · 이메일 · 연락처" value="${esc(F.q)}">${I('search', 'i--sm')}</div><button class="btn btn--line btn--sm" id="csv">CSV</button></div>` })}
      <div class="chips" style="margin-bottom:20px" id="ist">${TABS.map(([k, l]) => `<button class="chip${F.st === k ? ' is-on' : ''}" data-st="${k}">${l}</button>`).join('')}</div>
      <div class="card" id="il"><p class="loading">불러오는 중…</p></div>`;
    A.bindHead(main);
    $('#ist').onclick = e => { const b = e.target.closest('[data-st]'); if (!b) return; F.st = b.dataset.st; F.page = 1; $$('#ist .chip').forEach(x => x.classList.toggle('is-on', x === b)); load(); };
    let t; $('#iq').oninput = e => { clearTimeout(t); t = setTimeout(() => { F.q = e.target.value.trim(); F.page = 1; load(); }, 300); };
    $('#csv').onclick = csv;
    $('#il').onclick = e => { const pg = e.target.closest('[data-page]'); if (pg) { F.page = +pg.dataset.page; return load(); } const tr = e.target.closest('[data-id]'); if (tr) open(tr.dataset.id); };
    load();
  };
  async function load() {
    const from = (F.page - 1) * PAGE;
    const { data, count, error } = await query().range(from, from + PAGE - 1);
    if (error) return A.fail(error);
    const pages = Math.ceil(count / PAGE);
    $('#il').innerHTML = !data.length ? `<div class="empty">${F.q || F.st ? '조건에 맞는 문의가 없습니다.' : '아직 접수된 문의가 없습니다.<br>홈페이지 문의 폼으로 들어온 문의가 여기에 쌓입니다.'}</div>` :
      `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>접수일</th><th>이름</th><th>유형</th><th>예산</th><th>유입</th><th>상태</th></tr></thead><tbody>
      ${data.map(r => `<tr class="is-link" data-id="${r.id}"><td class="nowrap t2">${A.md_(r.created_at)}</td>
        <td><span class="t-main">${esc(r.name)}${r.company ? ` <span class="muted" style="font-weight:500">· ${esc(r.company)}</span>` : ''}</span><span class="t-sub">${esc(r.email || r.phone || '')}</span></td>
        <td><span class="clip" style="display:block">${esc(typeOf(r))}</span></td><td class="t2 nowrap">${esc(r.budget || '-')}</td><td class="t2 nowrap">${esc(A.SRC[r.source] || r.source || '-')}</td>
        <td><span class="pill pill--${r.status}">${A.INQ[r.status]}</span></td></tr>`).join('')}</tbody></table></div>
      ${pages > 1 ? `<div class="row" style="justify-content:center;padding:16px">${Array.from({ length: pages }, (_, i) => `<button class="chip${i + 1 === F.page ? ' is-on' : ''}" data-page="${i + 1}" style="height:32px;min-width:32px;padding:0 10px">${i + 1}</button>`).join('')}</div>` : ''}`;
  }
  async function open(id) {
    const { data: r, error } = await A.sb.from('inquiries').select('*').eq('id', id).single();
    if (error) return A.fail(error);
    const rows = [['구분', A.KIND[r.kind]], ['접수일', A.dtime(r.created_at)], ['담당자명', r.name], ['회사명', r.company],
      ['연락처', r.phone && `<a href="tel:${esc(r.phone.replace(/[^0-9+]/g, ''))}">${esc(r.phone)}</a>`, 1], ['이메일', r.email && `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`, 1],
      ['제목', r.subject], ['문의 유형', r.types?.join(', ')], ['예상 예산', r.budget], ['오픈 시기', r.schedule],
      ['참고 사이트', r.ref_url && (/^https?:\/\//.test(r.ref_url) ? `<a href="${esc(r.ref_url)}" target="_blank" rel="noopener">${esc(r.ref_url)}</a>` : esc(r.ref_url)), 1],
      ['유입 경로', A.SRC[r.source] || r.source], ...Object.entries(r.extra || {}), ['메일 알림', r.notified ? '발송됨' : '미발송']].filter(x => x[1]);
    const reply = `mailto:${encodeURIComponent(r.email || '')}?subject=${encodeURIComponent('Re: ' + (r.subject || `${A.site().name} ${A.KIND[r.kind]}`))}`;
    const d = A.drawer({ title: '문의 상세', body: `
      <div><p class="sec-t">상태</p><div class="chips" id="dst">${Object.entries(A.INQ).map(([k, l]) => `<button class="chip chip--blue${r.status === k ? ' is-on' : ''}" data-s="${k}" style="height:32px;padding:0 12px;font-size:13px">${l}</button>`).join('')}</div></div>
      <dl class="dl">${rows.map(([k, v, raw]) => `<dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd>`).join('')}</dl>
      ${r.message ? `<div><p class="sec-t">문의 내용</p><div class="msg">${esc(r.message)}</div></div>` : ''}
      <label class="field">내부 메모 <small>문의자에게는 보이지 않습니다</small><textarea id="memo" rows="4">${esc(r.memo || '')}</textarea></label>
      <div class="row"><button class="btn btn--primary btn--sm" id="msave">메모 저장</button>${r.email ? `<a class="btn btn--line btn--sm" href="${reply}">답장 메일 쓰기</a>` : ''}<span class="grow"></span><button class="btn btn--danger btn--sm" id="idel">삭제</button></div>` });
    const upd = async patch => { const { error } = await A.sb.from('inquiries').update(patch).eq('id', id); if (error) throw error; };
    d.el.querySelector('#dst').onclick = async e => { const b = e.target.closest('[data-s]'); if (!b) return; try { await upd({ status: b.dataset.s }); $$('#dst .chip', d.el).forEach(x => x.classList.toggle('is-on', x === b)); A.toast(`'${A.INQ[b.dataset.s]}'(으)로 변경했습니다.`); load(); A.refreshCounts(); } catch (er) { A.fail(er); } };
    d.el.querySelector('#msave').onclick = async () => { try { await upd({ memo: d.el.querySelector('#memo').value }); A.toast('메모를 저장했습니다.'); } catch (er) { A.fail(er); } };
    d.el.querySelector('#idel').onclick = async () => { if (!A.confirm('이 문의를 삭제할까요? 되돌릴 수 없습니다.')) return; const { error } = await A.sb.from('inquiries').delete().eq('id', id); if (error) return A.fail(error); d.close(); A.toast('삭제했습니다.'); load(); A.refreshCounts(); };
  }
  async function csv() {
    const { data, error } = await query('*', {}).limit(5000);
    if (error) return A.fail(error);
    const cols = [['created_at', '접수일'], ['kind', '구분'], ['status', '상태'], ['name', '담당자명'], ['company', '회사명'], ['phone', '연락처'], ['email', '이메일'], ['subject', '제목'], ['types', '문의유형'], ['budget', '예산'], ['schedule', '오픈시기'], ['source', '유입'], ['ref_url', '참고사이트'], ['message', '내용'], ['memo', '메모']];
    const cell = v => `"${String(Array.isArray(v) ? v.join(', ') : v ?? '').replace(/"/g, '""')}"`;
    const val = (r, k) => k === 'created_at' ? A.dtime(r[k]) : k === 'kind' ? A.KIND[r[k]] : k === 'status' ? A.INQ[r[k]] : k === 'source' ? A.SRC[r[k]] || r[k] : r[k];
    const out = '﻿' + [cols.map(c => cell(c[1])).join(','), ...data.map(r => cols.map(([k]) => cell(val(r, k))).join(','))].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv' })); a.download = `문의_${S.siteId}_${A.ymd(new Date()).replace(/-/g, '')}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  /* =============== 게시판 =============== */
  const B = { board: A.store.get('iuxc-board') || '', page: 1 };
  const loadBoards = async () => { const { data, error } = await A.sb.from('boards').select('*').eq('site_id', S.siteId).order('sort').order('created_at'); if (error) throw error; return data; };
  V['site:board'] = async (main, arg) => {
    if (arg) return editPost(main, arg);
    const boards = await loadBoards();
    if (!boards.length) { main.innerHTML = `${A.siteHead('게시판')}<div class="card empty">게시판이 없습니다.${A.isClient() ? '' : ` <a href="${A.siteHash('settings')}" style="color:var(--blue)">사이트 설정</a>에서 게시판을 추가하세요.`}</div>`; return A.bindHead(main); }
    if (!boards.some(b => b.slug === B.board)) { B.board = boards[0].slug; B.page = 1; }
    const kind = boards.find(b => b.slug === B.board).kind;
    main.innerHTML = `${A.siteHead('게시판', { extra: `<a class="btn btn--primary" href="${A.siteHash('board')}/new">${I('plus', 'i--sm')}${kind === 'faq' ? '질문 추가' : '글쓰기'}</a>` })}
      <div class="chips" style="margin-bottom:20px" id="bt">${boards.map(b => `<button class="chip${b.slug === B.board ? ' is-on' : ''}" data-b="${esc(b.slug)}">${esc(b.name)}</button>`).join('')}</div><div class="card" id="pl"><p class="loading">불러오는 중…</p></div>`;
    A.bindHead(main);
    $('#bt').onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; B.board = b.dataset.b; A.store.set('iuxc-board', B.board); B.page = 1; V['site:board'](main); };
    $('#pl').onclick = e => { const pg = e.target.closest('[data-page]'); if (pg) { B.page = +pg.dataset.page; return list(kind); } const tr = e.target.closest('[data-id]'); if (tr) A.go(`${A.siteHash('board')}/${tr.dataset.id}`); };
    list(kind);
  };
  async function list(kind) {
    const from = (B.page - 1) * PAGE;
    const { data, count, error } = await A.sb.from('posts').select('id,title,pinned,published,views,created_at', { count: 'exact' }).eq('site_id', S.siteId).eq('board', B.board)
      .order('pinned', { ascending: false }).order('created_at', { ascending: kind === 'faq' }).range(from, from + PAGE - 1);
    if (error) return A.fail(error);
    const pages = Math.ceil(count / PAGE);
    $('#pl').innerHTML = !data.length ? `<div class="empty">아직 글이 없습니다. 오른쪽 위 버튼으로 첫 글을 올려보세요.</div>` : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${kind === 'faq' ? '질문' : '제목'}</th><th>상태</th><th class="r">조회</th><th>작성일</th></tr></thead><tbody>
      ${data.map(p => `<tr class="is-link" data-id="${p.id}"><td class="t-main">${p.pinned ? '<span class="tag" style="margin-right:6px">고정</span>' : ''}${esc(p.title)}</td><td>${p.published ? '<span class="pill pill--done">공개</span>' : '<span class="pill">비공개</span>'}</td><td class="r num t2">${A.n(p.views)}</td><td class="t2 nowrap">${A.dot(p.created_at)}</td></tr>`).join('')}</tbody></table></div>
      ${pages > 1 ? `<div class="row" style="justify-content:center;padding:16px">${Array.from({ length: pages }, (_, i) => `<button class="chip${i + 1 === B.page ? ' is-on' : ''}" data-page="${i + 1}" style="height:32px;min-width:32px;padding:0 10px">${i + 1}</button>`).join('')}</div>` : ''}`;
  }
  async function editPost(main, id) {
    const boards = await loadBoards();
    let p = { title: '', body: '', cover_url: '', pinned: false, published: true, board: B.board || boards[0]?.slug, site_id: S.siteId };
    if (id !== 'new') { const { data, error } = await A.sb.from('posts').select('*').eq('id', id).single(); if (error) throw error; p = data; }
    if (!boards.length) return A.go(A.siteHash('board'));
    const kindOf = slug => boards.find(b => b.slug === slug)?.kind;
    main.innerHTML = `${A.siteHead(id === 'new' ? '글쓰기' : '글 수정', { open: false, extra: `<div class="row"><a class="btn btn--line" href="${A.siteHash('board')}">목록</a>${id !== 'new' ? '<button class="btn btn--danger" id="pdel">삭제</button>' : ''}<button class="btn btn--primary" id="psave">저장</button></div>` })}
      <div class="editor"><div class="card card__pad"><input class="editor__title" id="pt" maxlength="200" value="${esc(p.title)}">
        <div class="toolbar" id="tb"><button data-md="h">제목</button><button data-md="b"><b>B</b></button><button data-md="i"><i>I</i></button><button data-md="ul">• 목록</button><button data-md="q">인용</button><button data-md="link">링크</button><button data-md="img">이미지</button><span class="sp"></span><button data-md="pv" id="pvb">미리보기</button></div>
        <textarea class="body" id="pb">${esc(p.body)}</textarea><div class="md" id="pp" hidden style="min-height:440px;padding:8px 2px"></div></div>
        <div class="card card__pad stack" style="gap:18px"><label class="field">게시판<select id="pbd">${boards.map(b => `<option value="${esc(b.slug)}"${b.slug === p.board ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
          <div class="field">대표 이미지 <small>목록 · 공유용 (선택)</small><div id="pc">${A.dropHTML(p.cover_url, '클릭하거나 끌어다 놓기')}</div></div>
          <label class="check"><input type="checkbox" id="ppin"${p.pinned ? ' checked' : ''}><span id="ppinl">상단 고정</span></label>
          <label class="check"><input type="checkbox" id="ppub"${p.published ? ' checked' : ''}>홈페이지에 공개</label>
          ${id !== 'new' ? `<p class="muted" style="font-size:12px;line-height:1.8">작성 ${A.dtime(p.created_at)}<br>수정 ${A.dtime(p.updated_at)}<br>조회 ${A.n(p.views)}</p>` : ''}</div></div>`;
    const ta = $('#pb'); let cover = p.cover_url || '';
    const labels = () => { const faq = kindOf($('#pbd').value) === 'faq'; $('#pt').placeholder = faq ? '질문을 입력하세요 (예: 제작 기간은 얼마나 걸리나요?)' : '제목을 입력하세요'; ta.placeholder = faq ? '답변을 입력하세요.' : '내용을 입력하세요. 이미지는 이 칸에 끌어다 놓거나 붙여넣을 수 있습니다.'; $('#ppinl').textContent = faq ? '맨 위에 고정' : '상단 고정 (공지)'; };
    $('#pbd').onchange = labels; labels();
    const drawCover = () => { $('#pc').innerHTML = A.dropHTML(cover, '클릭하거나 끌어다 놓기'); $('#pc .drop').style.aspectRatio = '16/9'; A.bindDrop($('#pc .drop'), u => { cover = u; drawCover(); }); };
    drawCover();
    const wrap = (a, b = a, ph = '텍스트') => { const s = ta.selectionStart, e = ta.selectionEnd, t = ta.value.slice(s, e) || ph; ta.setRangeText(a + t + b, s, e, 'select'); ta.focus(); };
    const pre = x => { const s = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1; ta.setRangeText(x, s, s, 'end'); ta.focus(); };
    const ins = t => { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); };
    const imgs = async files => { for (const f of files) { if (!/^image\//.test(f.type)) continue; const mark = `![업로드 중… ${f.name}]()`; ins(`\n${mark}\n`); try { const u = await A.upload(f); ta.value = ta.value.replace(mark, `![](${u})`); } catch (e) { ta.value = ta.value.replace(mark, ''); A.fail(e, '이미지를 올리지 못했습니다.'); } } };
    $('#tb').onclick = async e => {
      const k = e.target.closest('[data-md]')?.dataset.md; if (!k) return;
      if (k === 'pv') { const on = $('#pp').hidden; $('#pp').hidden = !on; ta.hidden = on; $('#pvb').classList.toggle('is-on', on); if (on) $('#pp').innerHTML = IUXCloud.md(ta.value) || '<p class="muted">내용이 없습니다.</p>'; return; }
      ({ b: () => wrap('**'), i: () => wrap('*'), h: () => pre('## '), ul: () => pre('- '), q: () => pre('> ') })[k]?.();
      if (k === 'link') { const u = prompt('링크 주소', 'https://'); if (u) wrap('[', `](${u})`, '링크 텍스트'); }
      if (k === 'img') { const f = await A.pickFile(); if (f) imgs([f]); }
    };
    ta.addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); imgs(fs); } });
    ta.addEventListener('dragover', e => { e.preventDefault(); ta.classList.add('drop-on'); });
    ta.addEventListener('dragleave', () => ta.classList.remove('drop-on'));
    ta.addEventListener('drop', e => { e.preventDefault(); ta.classList.remove('drop-on'); imgs([...e.dataTransfer.files]); });
    $('#psave').onclick = async () => {
      const row = { title: $('#pt').value.trim(), body: ta.value, cover_url: cover || null, pinned: $('#ppin').checked, published: $('#ppub').checked, board: $('#pbd').value };
      if (!row.title) { $('#pt').focus(); return A.toast('제목을 입력해 주세요.', true); }
      if (/!\[업로드 중…/.test(row.body)) return A.toast('이미지 업로드가 끝난 뒤 저장해 주세요.', true);
      $('#psave').disabled = true;
      const q = id === 'new' ? A.sb.from('posts').insert({ ...row, site_id: S.siteId, author: S.user.id }).select('id').single() : A.sb.from('posts').update(row).eq('id', id).select('id').single();
      const { data, error } = await q; $('#psave').disabled = false;
      if (error) return A.fail(error, '저장하지 못했습니다.');
      B.board = row.board; A.store.set('iuxc-board', B.board); A.toast('저장했습니다.');
      if (id === 'new') A.go(`${A.siteHash('board')}/${data.id}`);
    };
    $('#pdel')?.addEventListener('click', async () => { if (!A.confirm('이 글을 삭제할까요?')) return; const { error } = await A.sb.from('posts').delete().eq('id', id); if (error) return A.fail(error); A.toast('삭제했습니다.'); A.go(A.siteHash('board')); });
    if (id === 'new') $('#pt').focus();
  }

  /* =============== 내 서비스 (고객사) =============== */
  V['site:service'] = async main => {
    const s = A.site(), o = s.ops || {}, d1 = A.dday(o.domainExp), d2 = A.dday(o.hostExp);
    const ssl = { ok: ['정상', ''], check: ['확인 필요', '조치 필요'], none: ['미설치', '조치 필요'] }[o.ssl] || ['-', ''];
    main.innerHTML = `${A.siteHead('내 서비스', { open: false })}
      <div class="grid g3" style="gap:16px;margin-bottom:24px">
        <div class="card card__pad svc"><div class="row row--sb"><span class="t2" style="font-size:13px;font-weight:700">도메인</span><span class="dday ${d1.c}">${d1.t}</span></div><h3>${esc(s.domain || '-')}</h3><div class="kv"><div><span>등록기관</span><b>${esc(o.registrar || '-')}</b></div><div><span>만료일</span><b>${A.dot(o.domainExp)}</b></div><div><span>연장 방식</span><b>${o.auto ? '자동 연장' : '수동 연장'}</b></div></div></div>
        <div class="card card__pad svc"><div class="row row--sb"><span class="t2" style="font-size:13px;font-weight:700">호스팅</span><span class="dday ${d2.c}">${d2.t}</span></div><h3>${esc([o.host, o.hostPlan].filter(Boolean).join(' ') || '-')}</h3><div class="kv"><div><span>만료일</span><b>${A.dot(o.hostExp)}</b></div><div><span>월 비용</span><b>${o.cost ? A.n(o.cost) + '원' : '-'}</b></div><div><span>명의</span><b>${o.owner === 'client' ? '고객' : o.owner ? '스튜디오' : '-'}</b></div></div></div>
        <div class="card card__pad svc"><div class="row row--sb"><span class="t2" style="font-size:13px;font-weight:700">SSL 보안 인증서</span><span class="dday is-neg">${ssl[1]}</span></div><h3>${ssl[0]}</h3><div class="kv"><div><span>적용 주소</span><b>${s.domain ? 'https://' + esc(s.domain) : '-'}</b></div></div></div></div>
      <div class="card card__pad row row--sb"><div><b style="font-size:16px">연장이나 변경이 필요하신가요?</b><p class="t2" style="font-size:13px;margin-top:4px">도메인 · 호스팅 연장과 상품 변경은 IUX.studio에서 대신 처리해 드립니다.</p></div><button class="btn btn--primary" id="req">연장 요청하기</button></div>`;
    $('#req').onclick = () => support('연장 요청', `도메인 · 호스팅 연장을 요청합니다.\n도메인: ${s.domain || '-'} (만료 ${A.dot(o.domainExp)})\n호스팅: ${o.host || '-'} (만료 ${A.dot(o.hostExp)})`);
  };
  const support = (kind, msg = '') => {
    const m = A.modal({ title: kind === '연장 요청' ? '연장 요청하기' : '고객센터 문의', body: `<p class="t2" style="font-size:13px">IUX.studio 담당자에게 전달되며, 영업일 기준 1일 이내에 연락드립니다.</p><label class="field">내용<textarea rows="6" id="sm">${esc(msg)}</textarea></label>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn btn--primary" data-send>보내기</button>` });
    m.el.querySelector('[data-send]').onclick = async () => {
      const t = m.el.querySelector('#sm').value.trim(); if (!t) return A.toast('내용을 입력해 주세요.', true);
      const { error } = await A.sb.rpc('request_support', { s: S.siteId, kind, msg: t });
      if (error) return A.fail(error, '보내지 못했습니다.');
      m.close(); A.toast('요청을 보냈습니다.');
    };
  };
  V['dlg:help'] = () => support('고객센터 문의');
})();
