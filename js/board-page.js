/* 일반 게시판 (board.html?b=주소) — 분류 · 첨부 · 작성자 · 방문자 글쓰기 · 댓글/대댓글 */
(async () => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = d => d.slice(0, 10).replace(/-/g, '.');
  const dtime = d => { const t = new Date(d); return `${fmt(d)} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
  const size = n => n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
  $('#year').textContent = new Date().getFullYear();
  const burger = $('#burger'), root = document.documentElement;
  const setMenu = v => { root.classList.toggle('menu-open', v); burger.setAttribute('aria-expanded', v); $('#mmenu').setAttribute('aria-hidden', !v); document.body.classList.toggle('lock', v); };
  burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));

  const S = await window.SiteReady, C = window.IUXCloud, V = $('#bdView');
  const q = new URLSearchParams(location.search), slug = q.get('b') || '';
  const B = (S.boards || []).find(b => b.slug === slug);
  if (!C?.ready || !B) { $('#bdTitle').textContent = '게시판을 찾을 수 없습니다.'; V.innerHTML = '<p class="board__empty"><a href="./" style="color:var(--blue)">홈으로 가기</a></p>'; return; }
  $('#bdTitle').textContent = B.name; $('#bdEyebrow').textContent = 'BOARD'; document.title = `${B.name} — ${S.company.name}`;
  const url = o => { const p = new URLSearchParams({ b: slug, ...o }); [...p.keys()].forEach(k => p.get(k) || p.delete(k)); return 'board.html?' + p; };
  const toast = (m, err) => { const t = document.createElement('div'); t.className = 'bd-toast' + (err ? ' is-err' : ''); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); };

  /* 비밀번호 + 로봇 확인 창 */
  function askPw(title) {
    return new Promise(res => {
      const m = document.createElement('div'); m.className = 'bd-modal';
      m.innerHTML = `<div class="bd-modal__dim" data-x></div><form class="bd-modal__box"><h3>${esc(title)}</h3><label class="bd-f">비밀번호<input type="password" name="pw" required minlength="4" autocomplete="off"></label><div class="bd-cap"></div><div class="bd-row"><button type="button" class="btn-line btn-line--grey" data-x>취소</button><button class="btn-write">확인</button></div></form>`;
      document.body.appendChild(m); document.body.classList.add('lock');
      let cap; C.captcha($('.bd-cap', m)).then(c => cap = c);
      const close = v => { m.remove(); document.body.classList.remove('lock'); res(v); };
      m.addEventListener('click', e => { if (e.target.closest('[data-x]')) close(null); });
      $('form', m).addEventListener('submit', e => { e.preventDefault(); const token = cap?.token(); if (!token) return toast('로봇이 아님을 확인해 주세요.', true); close({ pw: e.target.pw.value, token }); });
      setTimeout(() => $('input', m).focus(), 30);
    });
  }

  /* ---------- 목록 ---------- */
  async function list() {
    const page = Math.max(1, +q.get('page') || 1), cat = q.get('cat') || '', kw = q.get('q') || '';
    V.innerHTML = `<div class="bd-top">${B.categories.length ? `<div class="bd-cats">${['', ...B.categories].map(c => `<a href="${url({ cat: c })}" class="${c === cat ? 'is-on' : ''}">${esc(c || '전체')}</a>`).join('')}</div>` : '<span></span>'}
      <div class="board__tools" style="margin:0">${B.allow_write ? `<a class="btn-write" href="${url({ write: '1' })}"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>글쓰기</a>` : ''}
      <form class="board__search" id="sf" role="search"><input type="search" name="q" value="${esc(kw)}" placeholder="제목 검색" aria-label="제목 검색"><button aria-label="검색"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></button></form></div></div>
      <ul class="bd-list" id="bl"><li class="board__empty">불러오는 중…</li></ul><nav class="pager" id="pg"></nav>`;
    $('#sf').addEventListener('submit', e => { e.preventDefault(); location.href = url({ cat, q: e.target.q.value.trim() }); });
    try {
      const r = await C.listPosts(slug, { page, size: 15, q: kw, category: cat });
      $('#bl').innerHTML = r.items.length ? r.items.map(x => `<li><a href="${url({ id: x.id })}">
        ${x.pinned ? '<span class="badge">공지</span>' : x.category ? `<span class="bd-cat">${esc(x.category)}</span>` : ''}
        <span class="bd-t">${esc(x.title)}${x.comment_count ? `<em>[${x.comment_count}]</em>` : ''}${(x.attachments || []).length ? '<i class="bd-clip" title="첨부파일">📎</i>' : ''}</span>
        <span class="bd-m">${esc(x.is_admin ? (x.author_name || '관리자') : x.author_name || '-')}</span><span class="bd-m">${fmt(x.created_at)}</span><span class="bd-m">조회 ${x.views}</span></a></li>`).join('')
        : `<li class="board__empty">${kw || cat ? '조건에 맞는 글이 없습니다.' : '등록된 글이 없습니다.'}</li>`;
      const from = Math.max(1, page - 2), to = Math.min(r.pages, from + 4);
      $('#pg').innerHTML = r.pages < 2 ? '' : (page > 1 ? `<a href="${url({ cat, q: kw, page: page - 1 })}">‹</a>` : '') + Array.from({ length: to - from + 1 }, (_, k) => from + k).map(n => `<a href="${url({ cat, q: kw, page: n })}"${n === page ? ' aria-current="page"' : ''}>${n}</a>`).join('') + (page < r.pages ? `<a href="${url({ cat, q: kw, page: page + 1 })}">›</a>` : '');
    } catch (_) { $('#bl').innerHTML = '<li class="board__empty">목록을 불러오지 못했습니다.</li>'; }
  }

  /* ---------- 글 보기 + 댓글 ---------- */
  async function view(id) {
    const p = await C.getPost(id).catch(() => null);
    if (!p || p.board !== slug) { V.innerHTML = '<p class="board__empty">글을 찾을 수 없습니다.</p>'; return; }
    document.title = `${p.title} — ${S.company.name}`;
    const atts = p.attachments || [];
    V.innerHTML = `<article class="post"><header class="post__head">${p.category ? `<span class="bd-cat">${esc(p.category)}</span>` : ''}<h2 class="post__title">${esc(p.title)}</h2>
        <p class="post__meta" style="margin-top:12px">${esc(p.is_admin ? (p.author_name || '관리자') : p.author_name)} · ${dtime(p.created_at)} · 조회 ${p.views + 1}</p></header>
      ${p.cover_url ? `<img class="post__cover" src="${esc(p.cover_url)}" alt="">` : ''}
      <div class="post__body md">${C.md(p.body)}</div>
      ${atts.length ? `<div class="bd-files"><b>첨부파일 ${atts.length}</b>${atts.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener" download="${esc(a.name)}">📎 ${esc(a.name)} <small>${size(a.size || 0)}</small></a>`).join('')}</div>` : ''}
      <div class="post__foot"><a href="${url({})}" class="btn-line btn-line--grey">목록으로</a>${!p.is_admin && B.allow_write ? `<a class="btn-line btn-line--grey" href="${url({ edit: p.id })}">수정</a><button class="btn-line btn-line--grey" id="pdel">삭제</button>` : ''}</div></article>
      ${B.allow_comment ? `<section class="bd-cm"><h3>댓글 <span id="cmN">${p.comment_count}</span></h3><div id="cml"></div>${cmForm('')}</section>` : ''}`;
    $('#pdel')?.addEventListener('click', async () => {
      const a = await askPw('글 삭제'); if (!a) return;
      try { await C.deletePost(p.id, a.pw, a.token); toast('삭제했습니다.'); setTimeout(() => location.href = url({}), 600); } catch (e) { toast(e.message, true); }
    });
    if (B.allow_comment) { bindCm($('.bd-cm > form'), p.id, ''); comments(p.id); }
  }
  const cmForm = parent => `<form class="bd-cmf" data-parent="${parent}"><div class="bd-row"><input name="name" placeholder="이름" maxlength="30" required><input name="pw" type="password" placeholder="비밀번호 (4자 이상)" minlength="4" required autocomplete="off"></div>
    <textarea name="body" rows="3" maxlength="3000" placeholder="${parent ? '답글을 입력하세요' : '댓글을 입력하세요'}" required></textarea><input type="text" name="_gotcha" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="bd-row bd-row--end"><div class="bd-cap"></div><button class="btn-write">${parent ? '답글 등록' : '댓글 등록'}</button></div></form>`;
  function bindCm(f, postId, parent) {
    let cap; const capBox = $('.bd-cap', f);
    const load = () => { if (!cap) cap = C.captcha(capBox); };
    f.addEventListener('focusin', load, { once: true });
    f.addEventListener('submit', async e => {
      e.preventDefault(); if (f._gotcha.value) return;
      const c = await cap; const token = c?.token(); if (!token) return toast('로봇이 아님을 확인해 주세요.', true);
      const btn = $('button', f); btn.disabled = true;
      try { await C.createComment({ post: postId, parent: parent || null, name: f.name.value.trim(), pw: f.pw.value, body: f.body.value.trim(), token }); toast('등록했습니다.'); f.reset(); c.reset(); comments(postId); }
      catch (er) { toast(er.message, true); c.reset(); } finally { btn.disabled = false; }
    });
  }
  async function comments(postId) {
    const all = await C.getComments(postId), tops = all.filter(c => !c.parent_id);
    $('#cmN').textContent = all.filter(c => c.author_name !== '-').length;
    const item = (c, reply) => `<div class="bd-c${reply ? ' bd-c--re' : ''}${c.is_admin ? ' bd-c--admin' : ''}" data-id="${c.id}"><div class="bd-c__h"><b>${esc(c.author_name)}${c.is_admin ? '<span class="badge" style="margin-left:6px">관리자</span>' : ''}</b><small>${dtime(c.created_at)}</small></div>
      <p>${esc(c.body)}</p><div class="bd-c__a">${!reply && c.author_name !== '-' ? '<button data-re>답글</button>' : ''}${!c.is_admin && c.author_name !== '-' ? '<button data-del>삭제</button>' : ''}</div><div class="bd-c__re"></div></div>`;
    $('#cml').innerHTML = tops.length ? tops.map(t => item(t) + all.filter(r => r.parent_id === t.id).map(r => item(r, true)).join('')).join('') : '<p class="bd-empty">첫 댓글을 남겨보세요.</p>';
    $('#cml').onclick = async e => {
      const box = e.target.closest('[data-id]'); if (!box) return;
      if (e.target.closest('[data-re]')) { const slot = $('.bd-c__re', box); if (slot.innerHTML) { slot.innerHTML = ''; return; } slot.innerHTML = cmForm(box.dataset.id); bindCm($('form', slot), postId, box.dataset.id); $('input', slot).focus(); }
      if (e.target.closest('[data-del]')) { const a = await askPw('댓글 삭제'); if (!a) return; try { await C.deleteComment(box.dataset.id, a.pw, a.token); toast('삭제했습니다.'); comments(postId); } catch (er) { toast(er.message, true); } }
    };
  }

  /* ---------- 글쓰기 · 수정 ---------- */
  async function write(editId) {
    if (!B.allow_write) return list();
    let p = null, ticket = '', keep = [];
    if (editId) {
      p = await C.getPost(editId).catch(() => null); if (!p || p.is_admin) return view(editId);
      const a = await askPw('글 수정'); if (!a) return (location.href = url({ id: editId }));
      try { ticket = await C.checkPost(editId, a.pw, a.token); } catch (e) { toast(e.message, true); return setTimeout(() => location.href = url({ id: editId }), 900); }
      keep = (p.attachments || []).map(x => x.path);
    }
    V.innerHTML = `<form class="bd-w" id="wf"><h2>${editId ? '글 수정' : '글쓰기'}</h2>
      ${B.categories.length ? `<label class="bd-f">분류<select name="category" required><option value="">분류 선택</option>${B.categories.map(c => `<option${p?.category === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>` : ''}
      <div class="bd-row"><label class="bd-f">작성자<input name="name" maxlength="30" required value="${esc(p?.author_name || '')}"></label>${editId ? '' : '<label class="bd-f">비밀번호 <small>수정 · 삭제할 때 필요</small><input name="pw" type="password" minlength="4" required autocomplete="new-password"></label>'}</div>
      <label class="bd-f">제목<input name="title" maxlength="200" required value="${esc(p?.title || '')}"></label>
      <label class="bd-f">내용<textarea name="body" rows="12" required>${esc(p?.body || '')}</textarea></label>
      <div class="bd-f">첨부파일 <small>이미지 · PDF · 한글 · 오피스 · ZIP, 파일당 10MB, 최대 5개</small>
        <div id="oldf">${(p?.attachments || []).map(x => `<label class="bd-old"><input type="checkbox" checked value="${esc(x.path)}"> ${esc(x.name)} <small>${size(x.size || 0)}</small></label>`).join('')}</div>
        <input type="file" name="files" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.hwpx,.zip,.txt"></div>
      <input type="text" name="_gotcha" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      ${editId ? '' : '<div class="bd-cap" id="wcap"></div>'}
      <div class="bd-row bd-row--end"><a class="btn-line btn-line--grey" href="${editId ? url({ id: editId }) : url({})}">취소</a><button class="btn-write" id="wsend">${editId ? '수정 완료' : '등록'}</button></div></form>`;
    const cap = editId ? null : await C.captcha($('#wcap'));
    $('#wf').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target; if (f._gotcha.value) return;
      const keepNow = [...document.querySelectorAll('#oldf input:checked')].map(i => i.value);
      const files = [...f.files.files];
      if (files.length + keepNow.length > 5) return toast('첨부파일은 최대 5개입니다.', true);
      const big = files.find(x => x.size > 10 * 1024 * 1024); if (big) return toast(`10MB 이하 파일만 올릴 수 있습니다: ${big.name}`, true);
      const d = { board: slug, category: f.category?.value || '', name: f.name.value.trim(), title: f.title.value.trim(), body: f.body.value, files };
      $('#wsend').disabled = true; $('#wsend').textContent = files.length ? '올리는 중…' : '저장 중…';
      try {
        if (editId) { await C.updatePost(editId, ticket, { ...d, keep: keepNow }); toast('수정했습니다.'); setTimeout(() => location.href = url({ id: editId }), 500); }
        else { const token = cap.token(); if (!token) throw new Error('로봇이 아님을 확인해 주세요.'); const id = await C.createPost({ ...d, pw: f.pw.value, token }); toast('등록했습니다.'); setTimeout(() => location.href = url({ id }), 500); }
      } catch (er) { toast(er.message, true); cap?.reset(); $('#wsend').disabled = false; $('#wsend').textContent = editId ? '수정 완료' : '등록'; }
    });
  }

  if (q.get('write')) write(); else if (q.get('edit')) write(q.get('edit')); else if (q.get('id')) view(q.get('id')); else list();
})();
