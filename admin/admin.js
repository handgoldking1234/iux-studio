(() => {
  'use strict';
  const CFG = window.ADMIN_CONFIG || {};
  let INIT_HASH = location.hash; // 초대/재설정 링크 판별용 (supabase 가 곧 지움)
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = d => { const t = new Date(d); return `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`; };
  const fmtTime = d => { const t = new Date(d); return `${fmtDate(d)} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
  const STATUS = { new: '신규', progress: '처리중', done: '완료', spam: '스팸' };
  const KIND = { quote: '견적 문의', email: '이메일 문의', etc: '기타' };
  const BOARD_KIND = { list: '일반 게시판', gallery: '갤러리', faq: 'FAQ' };
  const PAGE = 20;
  const store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

  /* ---------- 공통 UI ---------- */
  let toastT;
  const toast = (m, err) => { const t = $('#toast'); t.textContent = m; t.classList.toggle('is-err', !!err); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); };
  const fail = (e, m = '처리하지 못했습니다.') => { console.error(e); toast(`${m} ${e?.message ? '(' + e.message + ')' : ''}`, true); };
  const view = $('#view');
  const loading = () => { view.innerHTML = '<p class="loading">불러오는 중…</p>'; };
  const pager = (total, page, size = PAGE) => {
    const pages = Math.ceil(total / size); if (pages < 2) return '';
    const from = Math.max(1, Math.min(page - 3, pages - 6)), to = Math.min(pages, from + 6);
    let h = page > 1 ? `<button data-page="${page - 1}" aria-label="이전">‹</button>` : '';
    for (let n = from; n <= to; n++) h += `<button data-page="${n}" class="${n === page ? 'is-on' : ''}">${n}</button>`;
    return `<nav class="pager">${h}${page < pages ? `<button data-page="${page + 1}" aria-label="다음">›</button>` : ''}</nav>`;
  };
  const likeTerm = q => '*' + q.replace(/[*,()%]/g, ' ').trim() + '*';

  /* ---------- 연결 ---------- */
  if (!CFG.supabaseUrl || !CFG.anonKey || !window.supabase) {
    $('#auth').hidden = false; $('#loginForm').hidden = true; $('#setupNotice').hidden = false; return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.anonKey);
  const S = { user: null, role: { admin: false, sites: [] }, sites: [], site: '', booted: false };

  /* ---------- 로그인 ---------- */
  const showAuth = mode => {
    $('#app').hidden = true; $('#auth').hidden = false;
    $('#loginForm').hidden = mode === 'pw'; $('#pwForm').hidden = mode !== 'pw';
  };
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, err = $('#loginErr'); err.hidden = true;
    f.querySelector('button[type=submit]').disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    f.querySelector('button[type=submit]').disabled = false;
    if (error) { err.textContent = error.message.includes('Invalid') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.message; err.hidden = false; }
  });
  $('#forgotBtn').addEventListener('click', async () => {
    const email = $('#loginForm').email.value.trim();
    if (!email) { $('#loginErr').textContent = '이메일을 먼저 입력해 주세요.'; $('#loginErr').hidden = false; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
    error ? fail(error) : toast('비밀번호 재설정 메일을 보냈습니다.');
  });
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: e.target.pw.value });
    if (error) { $('#pwErr').textContent = error.message; $('#pwErr').hidden = false; return; }
    toast('비밀번호가 저장되었습니다.'); e.target.reset(); INIT_HASH = '';
    history.replaceState(null, '', location.pathname + '#inbox'); boot();
  });
  $('#pwChangeBtn').addEventListener('click', () => showAuth('pw'));
  $('#logoutBtn').addEventListener('click', () => sb.auth.signOut());

  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'PASSWORD_RECOVERY' || (ev === 'SIGNED_IN' && /type=(invite|recovery)/.test(INIT_HASH))) { S.user = session.user; showAuth('pw'); return; }
    if (!session) { S.user = null; S.booted = false; showAuth('login'); return; }
    if (!S.booted || S.user?.id !== session.user.id) { S.user = session.user; setTimeout(boot); }
  });

  async function boot() {
    S.booted = true;
    const [{ data: role, error: e1 }, { data: sites, error: e2 }] = await Promise.all([sb.rpc('my_role'), sb.from('sites').select('*').order('created_at')]);
    if (e1 || e2) return fail(e1 || e2, '정보를 불러오지 못했습니다.');
    S.role = role; S.sites = sites || [];
    if (!S.role.admin && !S.sites.length) {
      showAuth('login'); $('#loginErr').textContent = '연결된 사이트가 없는 계정입니다. 운영자에게 문의해 주세요.'; $('#loginErr').hidden = false;
      return sb.auth.signOut();
    }
    $('#auth').hidden = true; $('#app').hidden = false;
    $('#userEmail').textContent = S.user.email;
    $('#userRole').textContent = S.role.admin ? '운영자' : '사이트 담당자';
    $$('[data-admin]').forEach(e => e.hidden = !S.role.admin);
    paintSiteSel();
    if (!location.hash || /access_token|type=/.test(location.hash)) history.replaceState(null, '', location.pathname + '#inbox');
    route(); refreshNewCount();
  }

  /* ---------- 사이트 선택 ---------- */
  const paintSiteSel = () => {
    const saved = store.get('iuxc-site');
    S.site = S.sites.some(s => s.id === saved) ? saved : (S.role.admin ? '' : S.sites[0].id);
    $('#siteSel').innerHTML = (S.role.admin || S.sites.length > 1 ? '<option value="">전체 사이트</option>' : '') +
      S.sites.map(s => `<option value="${esc(s.id)}">${esc(s.name)}${s.active ? '' : ' (중지)'}</option>`).join('');
    if (!S.role.admin && S.sites.length === 1) S.site = S.sites[0].id;
    $('#siteSel').value = S.site;
  };
  $('#siteSel').addEventListener('change', e => { S.site = e.target.value; store.set('iuxc-site', S.site); route(); refreshNewCount(); });
  const siteName = id => S.sites.find(s => s.id === id)?.name || id;

  async function refreshNewCount() {
    let q = sb.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new');
    if (S.site) q = q.eq('site_id', S.site);
    const { count } = await q;
    $('#newCnt').textContent = count > 99 ? '99+' : count; $('#newCnt').hidden = !count;
  }

  /* ---------- 라우팅 ---------- */
  addEventListener('hashchange', () => S.booted && route());
  function route() {
    const [v, arg] = location.hash.slice(1).split('/');
    $$('[data-nav]').forEach(a => a.classList.toggle('is-on', a.dataset.nav === v));
    closeDrawer();
    if (v === 'posts') return arg ? editPost(arg) : postsView();
    if (v === 'sites' && S.role.admin) return arg ? siteEdit(arg) : sitesView();
    return inboxView();
  }

  /* =========================================================
     문의함
     ========================================================= */
  const IB = { status: '', kind: '', q: '', page: 1 };
  async function inboxView() {
    if (!view.querySelector('#inbox')) {
      view.innerHTML = `<div id="inbox">
        <div class="ph"><div><h1>문의함</h1><p class="muted" id="ibSub"></p></div>
          <button class="btn" id="ibCsv" type="button">CSV 내려받기</button></div>
        <div class="kpis" id="kpis"></div>
        <div class="card">
          <div class="bar">
            <div class="tabs" id="ibTabs">${[['', '전체'], ...Object.entries(STATUS)].map(([k, l]) => `<button class="tab" data-st="${k}">${l}</button>`).join('')}</div>
            <select class="input" id="ibKind"><option value="">모든 구분</option>${Object.entries(KIND).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
            <input class="input grow" id="ibQ" type="search" placeholder="이름 · 회사 · 이메일 · 연락처 검색">
          </div>
          <div id="ibList"></div>
        </div></div>`;
      $('#ibTabs').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (b) { IB.status = b.dataset.st; IB.page = 1; loadInbox(); } });
      $('#kpis').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (b) { IB.status = b.dataset.st; IB.page = 1; loadInbox(); } });
      $('#ibKind').addEventListener('change', e => { IB.kind = e.target.value; IB.page = 1; loadInbox(); });
      let t; $('#ibQ').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { IB.q = e.target.value.trim(); IB.page = 1; loadInbox(); }, 300); });
      $('#ibList').addEventListener('click', e => {
        const p = e.target.closest('[data-page]'); if (p) { IB.page = +p.dataset.page; return loadInbox(); }
        const r = e.target.closest('tr[data-id]'); if (r) openInquiry(r.dataset.id);
      });
      $('#ibCsv').addEventListener('click', exportCsv);
    }
    $('#ibKind').value = IB.kind; $('#ibQ').value = IB.q;
    $('#ibSub').textContent = S.site ? siteName(S.site) : '전체 사이트';
    loadKpis(); loadInbox();
  }

  const inboxQuery = (sel = '*', opt = { count: 'exact' }) => {
    let q = sb.from('inquiries').select(sel, opt);
    if (S.site) q = q.eq('site_id', S.site);
    if (IB.status) q = q.eq('status', IB.status); else q = q.neq('status', 'spam');
    if (IB.kind) q = q.eq('kind', IB.kind);
    if (IB.q) { const l = likeTerm(IB.q); q = q.or(`name.ilike.${l},company.ilike.${l},email.ilike.${l},phone.ilike.${l}`); }
    return q.order('created_at', { ascending: false });
  };

  async function loadKpis() {
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const c = f => { let q = sb.from('inquiries').select('id', { count: 'exact', head: true }); if (S.site) q = q.eq('site_id', S.site); return f(q).then(r => r.count ?? 0); };
    const [n, p, m, a] = await Promise.all([c(q => q.eq('status', 'new')), c(q => q.eq('status', 'progress')), c(q => q.gte('created_at', month.toISOString()).neq('status', 'spam')), c(q => q.neq('status', 'spam'))]);
    if (!$('#kpis')) return;
    $('#kpis').innerHTML = [['new', '신규 문의', n, 'kpi--new'], ['progress', '처리중', p, ''], ['', '이번 달 접수', m, ''], ['', '전체 문의', a, '']]
      .map(([st, l, v, cls], i) => `<button class="card kpi ${cls}${i < 2 && IB.status === st ? ' is-on' : ''}" data-st="${st}"><p>${l}</p><b>${v.toLocaleString()}</b></button>`).join('');
  }

  async function loadInbox() {
    $$('#ibTabs .tab').forEach(b => b.classList.toggle('is-on', b.dataset.st === IB.status));
    $$('#kpis .kpi').forEach((b, i) => b.classList.toggle('is-on', i < 2 && b.dataset.st === IB.status));
    const box = $('#ibList'); box.innerHTML = '<p class="loading">불러오는 중…</p>';
    const from = (IB.page - 1) * PAGE;
    const { data, count, error } = await inboxQuery().range(from, from + PAGE - 1);
    if (error) return fail(error, '문의를 불러오지 못했습니다.');
    if (!data.length) { box.innerHTML = `<p class="empty">${IB.q || IB.status || IB.kind ? '조건에 맞는 문의가 없습니다.' : '아직 접수된 문의가 없습니다.'}</p>`; return; }
    box.innerHTML = `<table class="tbl"><thead><tr><th>접수일</th>${S.site ? '' : '<th>사이트</th>'}<th>문의자</th><th class="hide-m">내용</th><th>구분</th><th>상태</th></tr></thead><tbody>${data.map(r => `
      <tr data-id="${r.id}" class="${r.status === 'new' ? 'is-new' : ''}">
        <td class="nowrap muted">${fmtTime(r.created_at)}</td>
        ${S.site ? '' : `<td class="nowrap">${esc(siteName(r.site_id))}</td>`}
        <td><p class="t-main">${esc(r.name)}${r.company ? ` <span class="muted">· ${esc(r.company)}</span>` : ''}</p><p class="t-sub">${esc(r.phone || r.email)}</p></td>
        <td class="hide-m"><p class="t-clip">${esc(r.subject || r.types?.join(', ') || r.message || '-')}</p></td>
        <td class="nowrap">${KIND[r.kind] || r.kind}</td>
        <td><span class="pill pill--${r.status}">${STATUS[r.status]}</span></td>
      </tr>`).join('')}</tbody></table>${pager(count, IB.page)}`;
  }

  async function openInquiry(id) {
    const { data: r, error } = await sb.from('inquiries').select('*').eq('id', id).single();
    if (error) return fail(error);
    const rows = [['사이트', siteName(r.site_id)], ['구분', KIND[r.kind]], ['접수일', fmtTime(r.created_at)], ['담당자명', r.name], ['회사명', r.company],
      ['연락처', r.phone && `<a href="tel:${esc(r.phone.replace(/[^0-9+]/g, ''))}">${esc(r.phone)}</a>`, true],
      ['이메일', r.email && `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`, true], ['제목', r.subject],
      ['문의 유형', r.types?.join(', ')], ['예상 예산', r.budget], ['오픈 시기', r.schedule],
      ['참고 사이트', r.ref_url && /^https?:\/\//.test(r.ref_url) ? `<a href="${esc(r.ref_url)}" target="_blank" rel="noopener">${esc(r.ref_url)}</a>` : r.ref_url, true],
      ...Object.entries(r.extra || {}), ['메일 알림', r.notified ? '발송됨' : '미발송']].filter(x => x[1]);
    const reply = `mailto:${encodeURIComponent(r.email || '')}?subject=${encodeURIComponent('Re: ' + (r.subject || `${siteName(r.site_id)} ${KIND[r.kind]}`))}`;
    $('#dBody').innerHTML = `
      <div><p class="sec-t">상태</p><div class="status-btns">${Object.entries(STATUS).map(([k, l]) => `<button class="btn btn--sm${r.status === k ? ' is-on' : ''}" data-status="${k}">${l}</button>`).join('')}</div></div>
      <dl class="dl">${rows.map(([k, v, raw]) => `<dt>${esc(k)}</dt><dd>${raw ? v : esc(v)}</dd>`).join('')}</dl>
      ${r.message ? `<div><p class="sec-t">문의 내용</p><div class="msg">${esc(r.message)}</div></div>` : ''}
      <label class="field">내부 메모 <small>문의자에게는 보이지 않습니다</small><textarea id="memo" rows="4">${esc(r.memo || '')}</textarea></label>
      <div class="row"><button class="btn btn--primary" id="memoSave">메모 저장</button>${r.email ? `<a class="btn" href="${reply}">답장 메일 쓰기</a>` : ''}<span style="flex:1"></span><button class="btn btn--danger" id="inqDel">삭제</button></div>`;
    openDrawer();
    const upd = async patch => { const { error } = await sb.from('inquiries').update(patch).eq('id', id); if (error) throw error; };
    $$('[data-status]', $('#dBody')).forEach(b => b.addEventListener('click', async () => {
      try { await upd({ status: b.dataset.status }); $$('[data-status]', $('#dBody')).forEach(x => x.classList.toggle('is-on', x === b)); toast(`'${STATUS[b.dataset.status]}'(으)로 변경했습니다.`); afterChange(); } catch (e) { fail(e); }
    }));
    $('#memoSave').addEventListener('click', async () => { try { await upd({ memo: $('#memo').value }); toast('메모를 저장했습니다.'); } catch (e) { fail(e); } });
    $('#inqDel').addEventListener('click', async () => {
      if (!confirm('이 문의를 삭제할까요? 되돌릴 수 없습니다.')) return;
      const { error } = await sb.from('inquiries').delete().eq('id', id);
      if (error) return fail(error);
      toast('삭제했습니다.'); closeDrawer(); afterChange();
    });
    // 열람 시 신규 → 처리중
    if (r.status === 'new') { upd({ status: 'progress' }).then(() => { $$('[data-status]', $('#dBody')).forEach(x => x.classList.toggle('is-on', x.dataset.status === 'progress')); afterChange(); }).catch(() => {}); }
  }
  const afterChange = () => { if ($('#inbox')) { loadInbox(); loadKpis(); } refreshNewCount(); };

  async function exportCsv() {
    const { data, error } = await inboxQuery('*', {}).limit(5000);
    if (error) return fail(error);
    const cols = [['created_at', '접수일'], ['site_id', '사이트'], ['kind', '구분'], ['status', '상태'], ['name', '담당자명'], ['company', '회사명'], ['phone', '연락처'], ['email', '이메일'], ['subject', '제목'], ['types', '문의유형'], ['budget', '예산'], ['schedule', '오픈시기'], ['ref_url', '참고사이트'], ['message', '내용'], ['memo', '메모']];
    const cell = v => `"${String(Array.isArray(v) ? v.join(', ') : v ?? '').replace(/"/g, '""')}"`;
    const csv = '﻿' + [cols.map(c => cell(c[1])).join(','), ...data.map(r => cols.map(([k]) => cell(k === 'created_at' ? fmtTime(r[k]) : k === 'kind' ? KIND[r[k]] : k === 'status' ? STATUS[r[k]] : r[k])).join(','))].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `문의_${S.site || '전체'}_${fmtDate(new Date()).replace(/\./g, '')}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  /* drawer */
  const openDrawer = () => { $('#drawer').hidden = false; document.body.classList.add('lock'); };
  const closeDrawer = () => { $('#drawer').hidden = true; document.body.classList.remove('lock'); };
  $$('[data-x]', $('#drawer')).forEach(b => b.addEventListener('click', closeDrawer));
  addEventListener('keydown', e => e.key === 'Escape' && closeDrawer());

  /* =========================================================
     게시판
     ========================================================= */
  const PB = { board: '', page: 1 };
  const needSite = title => {
    view.innerHTML = `<div class="ph"><h1>${title}</h1></div><div class="card"><p class="empty">위쪽 <b>사이트</b> 선택에서 관리할 사이트를 먼저 골라주세요.</p></div>`;
  };
  const loadBoards = async site => { const { data, error } = await sb.from('boards').select('*').eq('site_id', site).order('sort').order('created_at'); if (error) throw error; return data; };

  async function postsView() {
    if (!S.site) return needSite('게시판');
    loading();
    let boards; try { boards = await loadBoards(S.site); } catch (e) { return fail(e); }
    if (!boards.length) {
      view.innerHTML = `<div class="ph"><h1>게시판</h1></div><div class="card"><p class="empty">이 사이트에 게시판이 없습니다.${S.role.admin ? ` <a href="#sites/${esc(S.site)}" style="color:var(--blue)">사이트 관리</a>에서 게시판을 추가하세요.` : ''}</p></div>`;
      return;
    }
    if (!boards.some(b => b.slug === PB.board)) { PB.board = boards[0].slug; PB.page = 1; }
    view.innerHTML = `<div class="ph"><div><h1>게시판</h1><p class="muted">${esc(siteName(S.site))}</p></div><a class="btn btn--primary" href="#posts/new">+ 글쓰기</a></div>
      <div class="card"><div class="bar"><div class="tabs" id="pbTabs">${boards.map(b => `<button class="tab${b.slug === PB.board ? ' is-on' : ''}" data-b="${esc(b.slug)}">${esc(b.name)}</button>`).join('')}</div></div><div id="pbList"></div></div>`;
    $('#pbTabs').addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (b) { PB.board = b.dataset.b; PB.page = 1; postsView(); } });
    $('#pbList').addEventListener('click', e => {
      const p = e.target.closest('[data-page]'); if (p) { PB.page = +p.dataset.page; return loadPosts(); }
      const r = e.target.closest('tr[data-id]'); if (r) location.hash = 'posts/' + r.dataset.id;
    });
    loadPosts();
  }
  async function loadPosts() {
    const from = (PB.page - 1) * PAGE;
    const { data, count, error } = await sb.from('posts').select('id,title,pinned,published,views,created_at', { count: 'exact' })
      .eq('site_id', S.site).eq('board', PB.board).order('pinned', { ascending: false }).order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (error) return fail(error);
    $('#pbList').innerHTML = !data.length ? '<p class="empty">아직 글이 없습니다. <b>+ 글쓰기</b>로 첫 글을 올려보세요.</p>' :
      `<table class="tbl"><thead><tr><th>제목</th><th>상태</th><th class="hide-m">조회</th><th>작성일</th></tr></thead><tbody>${data.map(p => `
        <tr data-id="${p.id}"><td><p class="t-main">${p.pinned ? '<span class="pill pill--new">공지</span> ' : ''}${esc(p.title)}</p></td>
        <td>${p.published ? '<span class="pill pill--done">공개</span>' : '<span class="pill">비공개</span>'}</td>
        <td class="hide-m muted">${p.views.toLocaleString()}</td><td class="nowrap muted">${fmtDate(p.created_at)}</td></tr>`).join('')}</tbody></table>${pager(count, PB.page)}`;
  }

  /* 이미지 업로드 (긴 변 1920px 로 줄여서 저장) */
  async function shrink(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
    const img = await createImageBitmap(file).catch(() => null); if (!img) return file;
    const k = Math.min(1, 1920 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise(r => c.toBlob(r, type, 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, type === 'image/webp' ? '.webp' : '.jpg'), { type }) : file;
  }
  async function upload(file) {
    if (!/^image\//.test(file.type)) throw new Error('이미지 파일만 올릴 수 있습니다.');
    const f = await shrink(file);
    if (f.size > 10 * 1024 * 1024) throw new Error('10MB 이하 이미지만 올릴 수 있습니다.');
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const d = new Date(), path = `${S.site}/${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from('media').upload(path, f, { cacheControl: '31536000', contentType: f.type });
    if (error) throw error;
    return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
  }
  const pickFile = () => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => res(i.files[0]); i.click(); });

  async function editPost(id) {
    if (!S.site && id === 'new') return needSite('글쓰기');
    loading();
    let p = { title: '', body: '', cover_url: '', pinned: false, published: true, board: PB.board, site_id: S.site };
    if (id !== 'new') {
      const { data, error } = await sb.from('posts').select('*').eq('id', id).single();
      if (error) return fail(error, '글을 불러오지 못했습니다.');
      p = data;
    }
    let boards; try { boards = await loadBoards(p.site_id); } catch (e) { return fail(e); }
    if (!boards.length) return postsView();
    if (!boards.some(b => b.slug === p.board)) p.board = boards[0].slug;
    view.innerHTML = `<div class="ph"><div><h1>${id === 'new' ? '글쓰기' : '글 수정'}</h1><p class="muted">${esc(siteName(p.site_id))}</p></div>
      <div class="row"><a class="btn" href="#posts">목록</a>${id !== 'new' ? '<button class="btn btn--danger" id="pDel">삭제</button>' : ''}<button class="btn btn--primary" id="pSave">저장</button></div></div>
      <div class="editor">
        <div class="card card__pad">
          <input class="editor__title" id="pTitle" placeholder="제목을 입력하세요" maxlength="200" value="${esc(p.title)}">
          <div class="toolbar" id="tb">
            <button data-md="h">제목</button><button data-md="b"><b>B</b></button><button data-md="i"><i>I</i></button>
            <button data-md="ul">• 목록</button><button data-md="q">인용</button><button data-md="link">링크</button><button data-md="img">이미지</button>
            <span class="sp"></span><button data-md="preview" id="pvBtn">미리보기</button>
          </div>
          <textarea class="body" id="pBody" placeholder="내용을 입력하세요. 이미지는 이 칸에 끌어다 놓거나 붙여넣을 수 있습니다.">${esc(p.body)}</textarea>
          <div class="preview" id="pPrev" hidden></div>
        </div>
        <div class="card card__pad side-card">
          <label class="field">게시판<select id="pBoard">${boards.map(b => `<option value="${esc(b.slug)}"${b.slug === p.board ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
          <div class="field">대표 이미지 <small>목록·공유용 (선택)</small>
            <div class="cover" id="pCover" role="button" tabindex="0">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="">` : '클릭해서 이미지 올리기'}</div>
            <button class="linkbtn" id="pCoverDel" type="button"${p.cover_url ? '' : ' hidden'}>대표 이미지 빼기</button>
          </div>
          <label class="check"><input type="checkbox" id="pPin"${p.pinned ? ' checked' : ''}>상단 고정 (공지)</label>
          <label class="check"><input type="checkbox" id="pPub"${p.published ? ' checked' : ''}>홈페이지에 공개</label>
          ${id !== 'new' ? `<p class="muted">작성 ${fmtTime(p.created_at)}<br>수정 ${fmtTime(p.updated_at)}<br>조회 ${p.views.toLocaleString()}</p>` : ''}
        </div>
      </div>`;
    const ta = $('#pBody');
    let cover = p.cover_url || '';
    const wrap = (a, b = a, ph = '텍스트') => { const s = ta.selectionStart, e = ta.selectionEnd, t = ta.value.slice(s, e) || ph; ta.setRangeText(a + t + b, s, e, 'select'); ta.focus(); };
    const linePrefix = pre => { const s = ta.value.lastIndexOf('\n', ta.selectionStart - 1) + 1; ta.setRangeText(pre, s, s, 'end'); ta.focus(); };
    const insert = t => { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); };
    const insertImages = async files => {
      for (const f of files) {
        if (!/^image\//.test(f.type)) continue;
        const mark = `![업로드 중… ${f.name}]()`; insert(`\n${mark}\n`);
        try { const url = await upload(f); ta.value = ta.value.replace(mark, `![](${url})`); } catch (e) { ta.value = ta.value.replace(mark, ''); fail(e, '이미지를 올리지 못했습니다.'); }
      }
    };
    $('#tb').addEventListener('click', async e => {
      const b = e.target.closest('[data-md]'); if (!b) return;
      const k = b.dataset.md;
      if (k === 'preview') { const on = $('#pPrev').hidden; $('#pPrev').hidden = !on; ta.hidden = on; b.classList.toggle('is-on', on); if (on) $('#pPrev').innerHTML = IUXCloud.md(ta.value) || '<p class="muted">내용이 없습니다.</p>'; return; }
      if (k === 'b') wrap('**'); if (k === 'i') wrap('*'); if (k === 'h') linePrefix('## '); if (k === 'ul') linePrefix('- '); if (k === 'q') linePrefix('> ');
      if (k === 'link') { const u = prompt('링크 주소를 입력하세요', 'https://'); if (u) wrap('[', `](${u})`, '링크 텍스트'); }
      if (k === 'img') { const f = await pickFile(); if (f) insertImages([f]); }
    });
    ta.addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); insertImages(fs); } });
    ta.addEventListener('dragover', e => { e.preventDefault(); ta.classList.add('drop'); });
    ta.addEventListener('dragleave', () => ta.classList.remove('drop'));
    ta.addEventListener('drop', e => { e.preventDefault(); ta.classList.remove('drop'); insertImages([...e.dataTransfer.files]); });
    const setCover = u => { cover = u; $('#pCover').innerHTML = u ? `<img src="${esc(u)}" alt="">` : '클릭해서 이미지 올리기'; $('#pCoverDel').hidden = !u; };
    const pickCover = async () => { const f = await pickFile(); if (!f) return; $('#pCover').textContent = '올리는 중…'; try { setCover(await upload(f)); } catch (e) { setCover(cover); fail(e, '이미지를 올리지 못했습니다.'); } };
    $('#pCover').addEventListener('click', pickCover);
    $('#pCover').addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pickCover()));
    $('#pCoverDel').addEventListener('click', () => setCover(''));
    $('#pSave').addEventListener('click', async () => {
      const row = { title: $('#pTitle').value.trim(), body: ta.value, cover_url: cover || null, pinned: $('#pPin').checked, published: $('#pPub').checked, board: $('#pBoard').value };
      if (!row.title) { $('#pTitle').focus(); return toast('제목을 입력해 주세요.', true); }
      if (/!\[업로드 중…/.test(row.body)) return toast('이미지 업로드가 끝난 뒤 저장해 주세요.', true);
      $('#pSave').disabled = true;
      const q = id === 'new' ? sb.from('posts').insert({ ...row, site_id: p.site_id, author: S.user.id }).select('id').single() : sb.from('posts').update(row).eq('id', id).select('id').single();
      const { data, error } = await q;
      $('#pSave').disabled = false;
      if (error) return fail(error, '저장하지 못했습니다.');
      PB.board = row.board; toast('저장했습니다.');
      if (id === 'new') history.replaceState(null, '', '#posts/' + data.id), editPost(data.id);
    });
    $('#pDel')?.addEventListener('click', async () => {
      if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
      const { error } = await sb.from('posts').delete().eq('id', id);
      if (error) return fail(error);
      toast('삭제했습니다.'); location.hash = 'posts';
    });
    if (id === 'new') $('#pTitle').focus();
  }

  /* =========================================================
     사이트 관리 (운영자)
     ========================================================= */
  async function sitesView() {
    loading();
    const { data: sites, error } = await sb.from('sites').select('*').order('created_at');
    if (error) return fail(error);
    S.sites = sites;
    const counts = await Promise.all(sites.map(s => sb.from('inquiries').select('id', { count: 'exact', head: true }).eq('site_id', s.id).eq('status', 'new').then(r => r.count || 0)));
    view.innerHTML = `<div class="ph"><div><h1>사이트 관리</h1><p class="muted">고객사 홈페이지 ${sites.length}곳</p></div><a class="btn btn--primary" href="#sites/new">+ 새 사이트</a></div>
      <div class="card">${!sites.length ? '<p class="empty">등록된 사이트가 없습니다.</p>' : `<table class="tbl"><thead><tr><th>사이트</th><th>사이트 ID</th><th class="hide-m">알림 메일</th><th>신규 문의</th><th>상태</th></tr></thead><tbody>${sites.map((s, i) => `
        <tr data-id="${esc(s.id)}"><td class="t-main">${esc(s.name)}</td><td><code>${esc(s.id)}</code></td>
        <td class="hide-m muted"><p class="t-clip">${esc(s.notify_emails.join(', ') || '미설정')}</p></td>
        <td>${counts[i] ? `<span class="pill pill--new">${counts[i]}</span>` : '<span class="muted">0</span>'}</td>
        <td>${s.active ? '<span class="pill pill--done">운영중</span>' : '<span class="pill">중지</span>'}</td></tr>`).join('')}</tbody></table>`}</div>`;
    view.querySelector('.tbl')?.addEventListener('click', e => { const r = e.target.closest('tr[data-id]'); if (r) location.hash = 'sites/' + r.dataset.id; });
  }

  const splitList = v => v.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);

  async function siteEdit(id) {
    loading();
    const isNew = id === 'new';
    let s = { id: '', name: '', notify_emails: [], allowed_origins: [], active: true };
    if (!isNew) {
      const { data, error } = await sb.from('sites').select('*').eq('id', id).single();
      if (error) return fail(error, '사이트를 찾을 수 없습니다.');
      s = data;
    }
    view.innerHTML = `<div class="ph"><div><h1>${isNew ? '새 사이트' : esc(s.name)}</h1><p class="muted">${isNew ? '고객사 홈페이지를 등록합니다.' : `사이트 ID <code>${esc(s.id)}</code>`}</p></div><a class="btn" href="#sites">목록</a></div>
      <div class="grid2">
        <form class="card card__pad form-grid" id="siteForm">
          <h2>기본 정보</h2>
          <label class="field">사이트 이름<input name="name" required maxlength="80" value="${esc(s.name)}" placeholder="예) 바른치과"></label>
          <label class="field">사이트 ID <small>영문 소문자·숫자·하이픈, 홈페이지 코드의 siteId 로 사용 (등록 후 변경 비권장)</small>
            <input name="id" required pattern="[a-z0-9][a-z0-9\\-]{1,39}" value="${esc(s.id)}" placeholder="예) bareun-dental"${isNew ? '' : ' readonly'}></label>
          <label class="field">문의 알림 메일 <small>여러 개는 쉼표나 줄바꿈으로 구분</small><textarea name="emails" rows="2" placeholder="owner@client.com">${esc(s.notify_emails.join('\n'))}</textarea></label>
          <label class="field">허용 도메인 <small>이 주소에서 온 문의만 받습니다. 비워두면 제한 없음</small><textarea name="origins" rows="2" placeholder="https://client.com&#10;https://www.client.com">${esc(s.allowed_origins.join('\n'))}</textarea></label>
          <label class="check"><input type="checkbox" name="active"${s.active ? ' checked' : ''}>운영중 (끄면 문의 접수 중지)</label>
          <div class="row row--end">${isNew ? '' : '<button type="button" class="btn btn--danger" id="siteDel">사이트 삭제</button>'}<button class="btn btn--primary" type="submit">${isNew ? '등록' : '저장'}</button></div>
        </form>
        ${isNew ? '' : `
        <div>
          <div class="card card__pad"><h2>게시판</h2><ul class="list" id="boardList"></ul>
            <form class="row" id="boardForm" style="margin-top:12px">
              <input class="input" name="name" placeholder="게시판 이름 (예: 공지사항)" required style="flex:1;min-width:140px">
              <input class="input" name="slug" placeholder="주소 (예: notice)" required pattern="[a-z0-9][a-z0-9\\-]{0,39}" style="width:140px">
              <select class="input" name="kind">${Object.entries(BOARD_KIND).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
              <button class="btn" type="submit">추가</button></form></div>
          <div class="card card__pad"><h2>담당자 계정</h2><p class="muted" style="margin:-8px 0 12px">고객사 담당자가 로그인하면 이 사이트의 문의·게시판만 볼 수 있습니다.</p>
            <ul class="list" id="memberList"></ul>
            <form class="row" id="memberForm" style="margin-top:12px"><input class="input" name="email" type="email" required placeholder="담당자 이메일" style="flex:1"><button class="btn" type="submit">추가</button></form>
            <p class="muted" style="margin-top:8px;font-size:12px">먼저 Supabase &gt; Authentication &gt; Users 에서 해당 이메일로 사용자를 초대(Invite)하거나 만들어야 합니다.</p></div>
        </div>`}
      </div>
      ${isNew ? '' : `<div class="card card__pad" style="margin-top:16px"><h2>홈페이지 설치 코드</h2>
        <p class="muted" style="margin:-8px 0 12px">고객사 홈페이지의 &lt;/body&gt; 바로 앞에 넣으세요.</p>
        <pre class="code" id="snippet"></pre><div class="row" style="margin-top:10px"><button class="btn btn--sm" id="copySnip">코드 복사</button></div></div>`}`;

    $('#siteForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const row = { name: f.name.value.trim(), notify_emails: splitList(f.emails.value), allowed_origins: splitList(f.origins.value).map(o => o.replace(/\/+$/, '')), active: f.active.checked };
      const bad = row.notify_emails.find(m => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)); if (bad) return toast(`메일 주소를 확인해 주세요: ${bad}`, true);
      const badO = row.allowed_origins.find(o => !/^https?:\/\/[^/]+$/.test(o)); if (badO) return toast(`도메인은 https://example.com 형식으로 입력해 주세요: ${badO}`, true);
      const q = isNew ? sb.from('sites').insert({ ...row, id: f.id.value.trim() }) : sb.from('sites').update(row).eq('id', s.id);
      const { error } = await q;
      if (error) return fail(error, error.code === '23505' ? '이미 있는 사이트 ID 입니다.' : '저장하지 못했습니다.');
      toast('저장했습니다.');
      const { data } = await sb.from('sites').select('*').order('created_at'); S.sites = data || S.sites; paintSiteSel();
      if (isNew) {
        await sb.from('boards').insert({ site_id: f.id.value.trim(), slug: 'notice', name: '공지사항', kind: 'list' });
        location.hash = 'sites/' + f.id.value.trim();
      }
    });
    if (isNew) return;

    $('#siteDel').addEventListener('click', async () => {
      const typed = prompt(`사이트를 삭제하면 이 사이트의 문의·게시판·글이 모두 삭제됩니다.\n계속하려면 사이트 ID(${s.id})를 입력하세요.`);
      if (typed !== s.id) return;
      const { error } = await sb.from('sites').delete().eq('id', s.id);
      if (error) return fail(error);
      S.sites = S.sites.filter(x => x.id !== s.id); if (S.site === s.id) { S.site = ''; store.set('iuxc-site', ''); } paintSiteSel();
      toast('삭제했습니다.'); location.hash = 'sites';
    });

    const snippet = `<script src="${CFG.clientScript}"><\/script>\n<script>\n  IUXCloud.init({\n    url: '${CFG.supabaseUrl}',\n    anonKey: '${CFG.anonKey}',\n    siteId: '${s.id}'\n  });\n  // 문의 보내기:   await IUXCloud.sendInquiry({ kind: 'quote', name, phone, email, message })\n  // 게시글 목록:   const { items } = await IUXCloud.listPosts('notice')\n<\/script>`;
    $('#snippet').textContent = snippet;
    $('#copySnip').addEventListener('click', () => navigator.clipboard.writeText(snippet).then(() => toast('복사했습니다.')));

    const paintBoards = async () => {
      const boards = await loadBoards(s.id).catch(e => (fail(e), []));
      $('#boardList').innerHTML = boards.length ? boards.map(b => `<li><div class="grow"><p class="t-main">${esc(b.name)}</p><p class="muted" style="font-size:12px">${esc(b.slug)} · ${BOARD_KIND[b.kind]}</p></div>
        <button class="btn btn--sm" data-rename="${esc(b.slug)}">이름 변경</button><button class="btn btn--sm btn--danger" data-del="${esc(b.slug)}">삭제</button></li>`).join('') : '<li class="muted">게시판이 없습니다.</li>';
    };
    $('#boardList').addEventListener('click', async e => {
      const r = e.target.closest('[data-rename]'), d = e.target.closest('[data-del]');
      if (r) { const n = prompt('새 게시판 이름'); if (!n) return; const { error } = await sb.from('boards').update({ name: n.trim() }).eq('site_id', s.id).eq('slug', r.dataset.rename); error ? fail(error) : paintBoards(); }
      if (d) { if (!confirm(`'${d.dataset.del}' 게시판과 안의 글이 모두 삭제됩니다. 계속할까요?`)) return; const { error } = await sb.from('boards').delete().eq('site_id', s.id).eq('slug', d.dataset.del); error ? fail(error) : (toast('삭제했습니다.'), paintBoards()); }
    });
    $('#boardForm').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target;
      const { error } = await sb.from('boards').insert({ site_id: s.id, name: f.name.value.trim(), slug: f.slug.value.trim(), kind: f.kind.value });
      if (error) return fail(error, error.code === '23505' ? '이미 있는 게시판 주소입니다.' : '추가하지 못했습니다.');
      f.reset(); paintBoards(); toast('게시판을 추가했습니다.');
    });

    const paintMembers = async () => {
      const { data, error } = await sb.rpc('list_site_members', { s: s.id });
      if (error) return fail(error);
      $('#memberList').innerHTML = data.length ? data.map(m => `<li><span class="grow">${esc(m.email)}</span><button class="btn btn--sm btn--danger" data-uid="${m.user_id}">해제</button></li>`).join('') : '<li class="muted">등록된 담당자가 없습니다.</li>';
    };
    $('#memberList').addEventListener('click', async e => {
      const b = e.target.closest('[data-uid]'); if (!b || !confirm('이 담당자의 접근 권한을 해제할까요?')) return;
      const { error } = await sb.from('site_members').delete().eq('site_id', s.id).eq('user_id', b.dataset.uid);
      error ? fail(error) : paintMembers();
    });
    $('#memberForm').addEventListener('submit', async e => {
      e.preventDefault();
      const { error } = await sb.rpc('add_site_member', { s: s.id, member_email: e.target.email.value });
      if (error) return fail(error, error.message.includes('user_not_found') ? '가입된 사용자가 아닙니다. Supabase에서 먼저 초대해 주세요.' : '추가하지 못했습니다.');
      e.target.reset(); paintMembers(); toast('담당자를 추가했습니다.');
    });
    paintBoards(); paintMembers();
  }
})();
