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
    B.cur = boards.find(b => b.slug === B.board); const kind = B.cur.kind;
    main.innerHTML = `${A.siteHead('게시판', { extra: `<div class="row">${A.isClient() ? '' : `<button class="btn btn--line" id="bset">${I('settings', 'i--sm')}게시판 설정</button>`}<a class="btn btn--primary" href="${A.siteHash('board')}/new">${I('plus', 'i--sm')}${kind === 'faq' ? '질문 추가' : '글쓰기'}</a></div>` })}
      <div class="chips" style="margin-bottom:20px" id="bt">${boards.map(b => `<button class="chip${b.slug === B.board ? ' is-on' : ''}" data-b="${esc(b.slug)}">${esc(b.name)}</button>`).join('')}</div><div class="card" id="pl"><p class="loading">불러오는 중…</p></div>`;
    A.bindHead(main);
    $('#bset')?.addEventListener('click', () => A.boardSettings(B.cur, () => V['site:board'](main)));
    $('#bt').onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; B.board = b.dataset.b; A.store.set('iuxc-board', B.board); B.page = 1; V['site:board'](main); };
    $('#pl').onclick = e => { const pg = e.target.closest('[data-page]'); if (pg) { B.page = +pg.dataset.page; return list(kind); } const tr = e.target.closest('[data-id]'); if (tr) A.go(`${A.siteHash('board')}/${tr.dataset.id}`); };
    list(kind);
  };
  const isGeneral = b => b && b.kind === 'list' && b.slug !== 'notice';
  async function list(kind) {
    const bd = B.cur, gen = isGeneral(bd), cats = bd?.categories?.length;
    const from = (B.page - 1) * PAGE;
    const { data, count, error } = await A.sb.from('posts').select('id,title,pinned,published,views,created_at,category,author_name,is_admin,comment_count,attachments', { count: 'exact' }).eq('site_id', S.siteId).eq('board', B.board)
      .order('pinned', { ascending: false }).order('created_at', { ascending: kind === 'faq' }).range(from, from + PAGE - 1);
    if (error) return A.fail(error);
    const pages = Math.ceil(count / PAGE);
    $('#pl').innerHTML = !data.length ? `<div class="empty">아직 글이 없습니다. 오른쪽 위 버튼으로 첫 글을 올려보세요.</div>` : `<div class="tbl-wrap"><table class="tbl tbl--center"><thead><tr><th style="width:110px">상태</th>${cats ? '<th style="width:110px">분류</th>' : ''}<th>${kind === 'faq' ? '질문' : '제목'}</th>${gen ? '<th style="width:140px">작성자</th>' : ''}<th style="width:90px">조회</th><th style="width:130px">작성일</th></tr></thead><tbody>
      ${data.map(p => `<tr class="is-link" data-id="${p.id}"><td>${p.published ? '<span class="pill pill--done">공개</span>' : '<span class="pill">숨김</span>'}</td>${cats ? `<td class="t2">${esc(p.category || '-')}</td>` : ''}
        <td class="t-main l">${p.pinned ? '<span class="tag" style="margin-right:6px">고정</span>' : ''}${esc(p.title)}${p.comment_count ? ` <span style="color:var(--blue)">[${p.comment_count}]</span>` : ''}${(p.attachments || []).length ? ' <span class="muted" title="첨부파일">📎</span>' : ''}</td>
        ${gen ? `<td class="t2">${esc(p.author_name || (p.is_admin ? '관리자' : '-'))}${p.is_admin ? '' : ' <span class="tag tag--off">방문자</span>'}</td>` : ''}<td class="num t2">${A.n(p.views)}</td><td class="t2 nowrap">${A.dot(p.created_at)}</td></tr>`).join('')}</tbody></table></div>
      ${pages > 1 ? `<div class="row" style="justify-content:center;padding:16px">${Array.from({ length: pages }, (_, i) => `<button class="chip${i + 1 === B.page ? ' is-on' : ''}" data-page="${i + 1}" style="height:32px;min-width:32px;padding:0 10px">${i + 1}</button>`).join('')}</div>` : ''}`;
  }

  /* 관리자 첨부파일 업로드 (files 버킷) */
  const EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'hwpx', 'zip', 'txt'];
  async function uploadFile(f, postKey) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (!EXT.includes(ext)) throw new Error(`허용되지 않는 형식입니다: ${f.name}`);
    if (f.size > 10 * 1024 * 1024) throw new Error(`10MB 이하만 올릴 수 있습니다: ${f.name}`);
    const type = /^(image\/(jpeg|png|gif|webp)|application\/pdf|text\/plain|application\/zip)$/.test(f.type) ? f.type : 'application/octet-stream';
    const path = `${S.siteId}/board/${postKey}/${crypto.randomUUID()}.${ext}`;
    const { error } = await A.sb.storage.from('files').upload(path, f, { contentType: type, cacheControl: '31536000' });
    if (error) throw error;
    return { name: f.name, size: f.size, type, path, url: A.sb.storage.from('files').getPublicUrl(path).data.publicUrl };
  }
  const fsize = n => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';

  async function editPost(main, id) {
    const boards = await loadBoards();
    const me = S.user.user_metadata?.name || '관리자';
    let p = { title: '', body: '', cover_url: '', pinned: false, published: true, board: B.board || boards[0]?.slug, site_id: S.siteId, category: '', author_name: me, is_admin: true, attachments: [] };
    if (id !== 'new') { const { data, error } = await A.sb.from('posts').select('*').eq('id', id).single(); if (error) throw error; p = data; }
    if (!boards.length) return A.go(A.siteHash('board'));
    const bOf = slug => boards.find(b => b.slug === slug);
    let atts = [...(p.attachments || [])]; const postKey = id === 'new' ? crypto.randomUUID() : id;
    main.innerHTML = `${A.siteHead(id === 'new' ? '글쓰기' : '글 수정', { open: false, extra: `<div class="row"><a class="btn btn--line" href="${A.siteHash('board')}">목록</a>${id !== 'new' ? '<button class="btn btn--danger" id="pdel">삭제</button>' : ''}<button class="btn btn--primary" id="psave">저장</button></div>` })}
      <div class="editor"><div class="stack" style="gap:16px"><div class="card card__pad"><input class="editor__title" id="pt" maxlength="200" value="${esc(p.title)}">
        <div class="toolbar" id="tb"><button data-md="h">제목</button><button data-md="b"><b>B</b></button><button data-md="i"><i>I</i></button><button data-md="ul">• 목록</button><button data-md="q">인용</button><button data-md="link">링크</button><button data-md="img">이미지</button><span class="sp"></span><button data-md="pv" id="pvb">미리보기</button></div>
        <textarea class="body" id="pb">${esc(p.body)}</textarea><div class="md" id="pp" hidden style="min-height:440px;padding:8px 2px"></div></div>
        <div class="card card__pad" id="attBox"><div class="card__h"><h2>첨부파일</h2><small>이미지 · PDF · 한글 · 오피스 · ZIP, 파일당 10MB, 최대 5개</small></div><ul class="list" id="atl"></ul><div class="row" style="margin-top:12px"><button class="btn btn--line btn--sm" id="atAdd">${I('plus', 'i--sm')}파일 추가</button></div></div>
        <div id="cmBox"></div></div>
        <div class="card card__pad stack" style="gap:18px"><label class="field">게시판<select id="pbd">${boards.map(b => `<option value="${esc(b.slug)}"${b.slug === p.board ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
          <label class="field" id="pcatW">분류<select id="pcat"></select></label>
          <label class="field" id="pauW">작성자<input id="pau" value="${esc(p.author_name || (p.is_admin ? me : ''))}" maxlength="30"${p.is_admin ? '' : ' readonly'}>${p.is_admin ? '' : '<small>방문자가 쓴 글입니다.</small>'}</label>
          <div class="field">대표 이미지 <small>목록 · 공유용 (선택)</small><div id="pc"></div></div>
          <label class="check"><input type="checkbox" id="ppin"${p.pinned ? ' checked' : ''}><span id="ppinl">상단 고정</span></label>
          <label class="check"><input type="checkbox" id="ppub"${p.published ? ' checked' : ''}>홈페이지에 공개</label>
          ${id !== 'new' ? `<p class="muted" style="font-size:12px;line-height:1.8">작성 ${A.dtime(p.created_at)}<br>수정 ${A.dtime(p.updated_at)}<br>조회 ${A.n(p.views)}</p>` : ''}</div></div>`;
    const ta = $('#pb'); let cover = p.cover_url || '';
    const labels = () => {
      const b = bOf($('#pbd').value), faq = b?.kind === 'faq', gen = isGeneral(b);
      $('#pt').placeholder = faq ? '질문을 입력하세요 (예: 제작 기간은 얼마나 걸리나요?)' : '제목을 입력하세요';
      ta.placeholder = faq ? '답변을 입력하세요.' : '내용을 입력하세요. 이미지는 이 칸에 끌어다 놓거나 붙여넣을 수 있습니다.';
      $('#ppinl').textContent = faq ? '맨 위에 고정' : '상단 고정 (공지)';
      $('#pcatW').hidden = !b?.categories?.length; $('#pcat').innerHTML = `<option value="">분류 없음</option>${(b?.categories || []).map(c => `<option${c === p.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}`;
      $('#pauW').hidden = !gen; $('#attBox').hidden = faq;
    };
    $('#pbd').onchange = labels; labels();
    const drawCover = () => { $('#pc').innerHTML = A.dropHTML(cover, '클릭하거나 끌어다 놓기'); $('#pc .drop').style.aspectRatio = '16/9'; A.bindDrop($('#pc .drop'), u => { cover = u; drawCover(); }); };
    drawCover();
    const drawAtts = () => { $('#atl').innerHTML = atts.length ? atts.map((a, i) => `<li><span class="grow"><a href="${esc(a.url)}" target="_blank" rel="noopener">📎 ${esc(a.name)}</a> <small class="muted">${fsize(a.size || 0)}</small></span><button class="btn btn--xs btn--danger" data-rm="${i}">빼기</button></li>`).join('') : '<li class="muted">첨부파일이 없습니다.</li>'; $('#atAdd').disabled = atts.length >= 5; };
    drawAtts();
    $('#atl').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { atts.splice(+b.dataset.rm, 1); drawAtts(); } };
    $('#atAdd').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = EXT.map(x => '.' + x).join(','); i.onchange = async () => {
      for (const f of [...i.files].slice(0, 5 - atts.length)) { $('#atAdd').textContent = '올리는 중…'; try { atts.push(await uploadFile(f, postKey)); } catch (e) { A.fail(e, '파일을 올리지 못했습니다.'); } }
      $('#atAdd').innerHTML = `${I('plus', 'i--sm')}파일 추가`; drawAtts(); }; i.click(); };
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
      const b = bOf($('#pbd').value);
      const row = { title: $('#pt').value.trim(), body: ta.value, cover_url: cover || null, pinned: $('#ppin').checked, published: $('#ppub').checked, board: b.slug,
        category: b.categories?.length ? $('#pcat').value || null : null, attachments: b.kind === 'faq' ? [] : atts };
      if (p.is_admin) row.author_name = isGeneral(b) ? $('#pau').value.trim() || me : null;
      if (!row.title) { $('#pt').focus(); return A.toast('제목을 입력해 주세요.', true); }
      if (/!\[업로드 중…/.test(row.body)) return A.toast('이미지 업로드가 끝난 뒤 저장해 주세요.', true);
      $('#psave').disabled = true;
      const q = id === 'new' ? A.sb.from('posts').insert({ ...row, id: postKey, site_id: S.siteId, author: S.user.id, is_admin: true }).select('id').single() : A.sb.from('posts').update(row).eq('id', id).select('id').single();
      const { data, error } = await q; $('#psave').disabled = false;
      if (error) return A.fail(error, '저장하지 못했습니다.');
      B.board = row.board; A.store.set('iuxc-board', B.board); A.toast('저장했습니다.');
      if (id === 'new') A.go(`${A.siteHash('board')}/${data.id}`);
    };
    $('#pdel')?.addEventListener('click', async () => {
      if (!A.confirm('이 글을 삭제할까요? 댓글과 첨부파일도 함께 삭제됩니다.')) return;
      const paths = atts.map(a => a.path).filter(Boolean); if (paths.length) await A.sb.storage.from('files').remove(paths);
      const { error } = await A.sb.from('posts').delete().eq('id', id); if (error) return A.fail(error); A.toast('삭제했습니다.'); A.go(A.siteHash('board'));
    });
    if (id === 'new') $('#pt').focus(); else if (bOf(p.board)?.allow_comment || p.comment_count) comments(id);
  }

  /* 댓글 관리: 숨김 · 삭제 · 관리자 답글 */
  async function comments(postId) {
    const box = $('#cmBox'); if (!box) return;
    const { data, error } = await A.sb.from('comments').select('*').eq('post_id', postId).order('created_at');
    if (error) return A.fail(error);
    const tops = data.filter(c => !c.parent_id);
    const item = (c, re) => `<div class="cmt${re ? ' cmt--re' : ''}${c.hidden ? ' is-hidden' : ''}" data-id="${c.id}"><div class="row row--sb"><div><b>${esc(c.author_name)}</b>${c.is_admin ? ' <span class="tag">관리자</span>' : ''}${c.hidden ? ' <span class="tag tag--off">숨김</span>' : ''} <small class="muted">${A.dtime(c.created_at)}</small></div>
      <div class="row">${re ? '' : '<button class="btn btn--xs" data-re>답글</button>'}<button class="btn btn--xs" data-hide>${c.hidden ? '보이기' : '숨기기'}</button><button class="btn btn--xs btn--danger" data-del>삭제</button></div></div><p>${esc(c.body)}</p><div class="cmt__re"></div></div>`;
    box.innerHTML = `<div class="card card__pad"><div class="card__h"><h2>댓글 ${data.filter(c => !c.hidden).length}</h2><small>숨긴 댓글은 홈페이지에 보이지 않습니다</small></div>
      <div id="cml">${tops.length ? tops.map(t => item(t) + data.filter(r => r.parent_id === t.id).map(r => item(r, 1)).join('')).join('') : '<p class="muted" style="font-size:13px">아직 댓글이 없습니다.</p>'}</div>
      <form class="row" id="cmf" style="margin-top:16px;align-items:flex-start"><textarea class="inp grow" rows="2" name="body" placeholder="관리자 댓글" required></textarea><button class="btn btn--primary btn--sm">등록</button></form></div>`;
    const add = async (body, parent) => { const { error } = await A.sb.from('comments').insert({ site_id: S.siteId, post_id: postId, parent_id: parent || null, author_name: S.user.user_metadata?.name || '관리자', body, is_admin: true, author: S.user.id }); if (error) return A.fail(error); A.toast('등록했습니다.'); comments(postId); };
    $('#cmf').onsubmit = e => { e.preventDefault(); add(e.target.body.value.trim()); };
    $('#cml').onclick = async e => {
      const c = e.target.closest('[data-id]'); if (!c) return; const row = data.find(x => x.id === c.dataset.id);
      if (e.target.closest('[data-hide]')) { const { error } = await A.sb.from('comments').update({ hidden: !row.hidden }).eq('id', row.id); if (error) return A.fail(error); comments(postId); }
      if (e.target.closest('[data-del]')) { if (!A.confirm(data.some(x => x.parent_id === row.id) ? '답글까지 모두 삭제할까요?' : '이 댓글을 삭제할까요?')) return; const { error } = await A.sb.from('comments').delete().eq('id', row.id); if (error) return A.fail(error); comments(postId); }
      if (e.target.closest('[data-re]')) { const slot = $('.cmt__re', c); if (slot.innerHTML) { slot.innerHTML = ''; return; } slot.innerHTML = `<form class="row" style="margin-top:10px;align-items:flex-start"><textarea class="inp grow" rows="2" name="body" placeholder="관리자 답글" required></textarea><button class="btn btn--primary btn--sm">답글 등록</button></form>`; $('form', slot).onsubmit = ev => { ev.preventDefault(); add(ev.target.body.value.trim(), row.id); }; $('textarea', slot).focus(); }
    };
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
