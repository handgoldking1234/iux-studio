(() => {
  'use strict';
  const S = window.SITE, C = window.IUXCloud;
  const $ = s => document.querySelector(s);
  const main = $('[data-board]'), board = main.dataset.board;
  const list = $('#postList'), pager = $('#pager');
  const fmt = d => d.slice(0, 10).replace(/-/g, '.');
  $('#year').textContent = new Date().getFullYear();

  /* 모바일 메뉴 */
  const burger = $('#burger'), root = document.documentElement;
  const setMenu = v => { root.classList.toggle('menu-open', v); burger.setAttribute('aria-expanded', v); $('#mmenu').setAttribute('aria-hidden', !v); document.body.classList.toggle('lock', v); };
  burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  addEventListener('keydown', e => e.key === 'Escape' && setMenu(false));

  const msg = t => { list.innerHTML = `<li class="board__empty">${t}</li>`; pager.innerHTML = ''; };
  if (S?.cloud) C.init(S.cloud);
  if (!C.ready) { msg('게시판을 준비 중입니다.'); return; }

  C.getBoard(board).then(b => { if (b) { $('#boardTitle').textContent = b.name; document.title = `${b.name} — ${S.company.name}`; } });

  async function showList() {
    const p = new URLSearchParams(location.search), page = Math.max(1, +p.get('page') || 1), q = p.get('q') || '';
    $('#searchForm').q.value = q;
    $('#listView').hidden = false; $('#postView').hidden = true;
    msg('불러오는 중…');
    try {
      const r = await C.listPosts(board, { page, size: 10, q });
      if (!r.items.length) return msg(q ? `'${C.esc(q)}' 검색 결과가 없습니다.` : '등록된 글이 없습니다.');
      list.innerHTML = r.items.map(x => `<li><a href="?id=${x.id}">
        <span class="board__t">${x.pinned ? '<span class="badge">공지</span>' : ''}${C.esc(x.title)}</span>
        <span class="board__ex">${C.esc(x.excerpt)}</span>
        <span class="board__date">${fmt(x.created_at)}</span></a></li>`).join('');
      const qs = n => `?page=${n}${q ? '&q=' + encodeURIComponent(q) : ''}`;
      const from = Math.max(1, page - 2), to = Math.min(r.pages, from + 4);
      pager.innerHTML = r.pages < 2 ? '' :
        (page > 1 ? `<a href="${qs(page - 1)}" aria-label="이전">‹</a>` : '') +
        Array.from({ length: to - from + 1 }, (_, k) => from + k).map(n => `<a href="${qs(n)}"${n === page ? ' aria-current="page"' : ''}>${n}</a>`).join('') +
        (page < r.pages ? `<a href="${qs(page + 1)}" aria-label="다음">›</a>` : '');
    } catch (_) { msg('목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
  }

  async function showPost(id) {
    $('#listView').hidden = true; $('#postView').hidden = false;
    $('#postTitle').textContent = '불러오는 중…';
    const p = await C.getPost(id).catch(() => null);
    if (!p) { $('#postTitle').textContent = '글을 찾을 수 없습니다.'; $('#postMeta').textContent = ''; $('#postBody').innerHTML = ''; return; }
    document.title = `${p.title} — ${S.company.name}`;
    $('#postTitle').textContent = p.title;
    $('#postMeta').textContent = `${fmt(p.created_at)} · 조회 ${p.views + 1}`;
    const cv = $('#postCover'); cv.hidden = !p.cover_url; if (p.cover_url) cv.src = p.cover_url;
    $('#postBody').innerHTML = C.md(p.body);
    if (document.referrer.includes('notice.html') && !document.referrer.includes('id=')) $('#backBtn').href = document.referrer;
  }

  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = e.target.q.value.trim();
    location.search = q ? '?q=' + encodeURIComponent(q) : '';
  });

  const id = new URLSearchParams(location.search).get('id');
  id ? showPost(id) : showList();
})();
