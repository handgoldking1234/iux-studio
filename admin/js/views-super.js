/* 슈퍼 어드민 화면: 전체 현황 · 사이트 제작 · 도메인/호스팅 · 관리자 계정 · 사이트 설정 · 내 정보 */
(() => {
  'use strict';
  const { $, $$, esc, I, S } = A;
  const V = A.views;

  /* =============== 전체 현황 =============== */
  V.overview = async main => {
    main.innerHTML = `<div class="ph"><div><h1>전체 현황</h1><p class="sub">운영 중인 모든 사이트를 한눈에 봅니다.</p></div>${A.periodHTML()}</div><div id="ov"><p class="loading">불러오는 중…</p></div>`;
    A.bindPeriod(main, () => V.overview(main));
    const r = A.range();
    const { data, error } = await A.sb.rpc('overview_stats', { d_from: r.from.toISOString(), d_to: r.to.toISOString() });
    if (error) return A.fail(error);
    const st = Object.fromEntries((data || []).map(x => [x.id, x]));
    const sum = k => (data || []).reduce((a, x) => a + (x[k] || 0), 0);
    $('#ov').innerHTML = `<div class="grid g4" style="margin-bottom:24px">
        ${A.kpi('운영 사이트', S.sites.filter(s => s.stage === 'live').length + '개', 'globe')}
        ${A.kpi('제작 · 검수 중', S.sites.filter(s => s.stage !== 'live').length + '개', 'wrench')}
        ${A.kpi('전체 방문자', A.n(sum('visitors')), 'users')}
        ${A.kpi('전체 문의', A.n(sum('inquiries')) + '건', 'inq')}</div>
      <div class="card tbl-wrap">${S.sites.length ? `<table class="tbl"><thead><tr><th>사이트</th><th>도메인</th><th>상태</th><th class="r">방문자</th><th class="r">문의</th><th class="r">이탈률</th><th></th></tr></thead><tbody>
        ${S.sites.map(s => { const x = st[s.id] || {}, live = s.stage !== 'build'; return `<tr class="is-link" data-id="${esc(s.id)}">
          <td><span class="t-main">${esc(s.name)}</span><span class="t-sub">${esc(s.category)}${s.manager ? ' · ' + esc(s.manager) : ''}</span></td>
          <td class="t2">${esc(s.domain || '-')}</td><td><span class="stage stage--${s.stage}">${A.STAGE[s.stage]}</span></td>
          <td class="r num t-main">${live ? A.n(x.visitors) : '—'}</td><td class="r num">${live ? A.n(x.inquiries) : '—'}${x.new_inquiries ? ` <span class="pill pill--new" style="height:20px;padding:0 7px;margin-left:4px">${x.new_inquiries}</span>` : ''}</td>
          <td class="r num t2">${live && x.bounce != null ? x.bounce + '%' : '—'}</td><td class="r"><button class="btn btn--xs">관리</button></td></tr>`; }).join('')}
        </tbody></table>` : `<div class="empty">아직 등록된 사이트가 없습니다.<br><a href="#/build" style="color:var(--blue)">사이트 만들기</a></div>`}</div>`;
    $('#ov tbody')?.addEventListener('click', e => { const tr = e.target.closest('[data-id]'); if (tr) A.go(A.siteHash('dash', tr.dataset.id)); });
  };

  /* =============== 사이트 제작 =============== */
  const slug = (domain, name) => {
    let s = (domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!s) s = (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!/^[a-z0-9]/.test(s) || s.length < 2) s = 'site-' + Math.random().toString(36).slice(2, 6);
    s = s.slice(0, 36); let id = s, k = 2;
    while (S.sites.some(x => x.id === id)) id = `${s}-${k++}`;
    return id;
  };
  V.build = async main => {
    const f = { name: '', domain: '', cat: '기업', manager: '', copy: true };
    main.innerHTML = `<div class="ph"><div><h1>사이트 제작</h1><p class="sub">새 고객 사이트를 등록하고 제작 단계를 관리합니다.</p></div></div>
      <div class="g-12"><form class="card card__pad stack" id="nf" style="gap:20px">
        <h2 style="font-size:20px;font-weight:800">새 사이트 만들기</h2>
        <label class="field">사이트명<input name="name" placeholder="예: 새봄치과" maxlength="60" required></label>
        <label class="field">도메인<input name="domain" placeholder="example.co.kr"></label>
        <div class="field">템플릿<div class="chips" id="tpl">${A.CATS.map(c => `<button type="button" class="chip chip--blue${c === f.cat ? ' is-on' : ''}" data-c="${c}">${c}</button>`).join('')}</div></div>
        <label class="field">담당자<input name="manager" placeholder="담당 디자이너"></label>
        <label class="check"><input type="checkbox" name="copy" checked>IUX.studio 콘텐츠 구조 복제</label>
        <button class="btn btn--primary btn--block" id="nfBtn" disabled>사이트 만들기</button></form>
        <div class="stack" id="bl" style="gap:12px"></div></div>`;
    const form = $('#nf');
    form.addEventListener('input', () => { $('#nfBtn').disabled = !form.name.value.trim(); });
    $('#tpl').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; f.cat = b.dataset.c; $$('#tpl .chip').forEach(x => x.classList.toggle('is-on', x === b)); });
    form.addEventListener('submit', async e => {
      e.preventDefault(); $('#nfBtn').disabled = true;
      const name = form.name.value.trim(), domain = form.domain.value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const id = slug(domain, name);
      let content = {}, seo = {};
      if (form.copy.checked) {
        const { data } = await A.sb.from('sites').select('content,seo').eq('id', 'iux-studio').maybeSingle();
        if (data) { content = { ...data.content, company: { name } , popups: [], works: (data.content.works || []).map(w => ({ ...w, img: '' })) }; seo = { pages: {} }; }
      }
      const row = { id, name, domain: domain || null, category: f.cat, manager: form.manager.value.trim() || null, stage: 'build', color: A.TINTS[S.sites.length % A.TINTS.length], content, seo,
        allowed_origins: domain ? [`https://${domain}`, `https://www.${domain.replace(/^www\./, '')}`] : [] };
      const { error } = await A.sb.from('sites').insert(row);
      if (error) { $('#nfBtn').disabled = false; return A.fail(error, '사이트를 만들지 못했습니다.'); }
      await A.sb.from('boards').insert({ site_id: id, slug: 'notice', name: '공지사항', kind: 'list' });
      await A.loadSites(); A.paintSide();
      A.toast(`'${name}' 사이트를 만들었습니다.`); form.reset(); form.copy.checked = true; paintList();
    });
    const paintList = () => {
      $('#bl').innerHTML = S.sites.length ? [...S.sites].reverse().map(s => `<div class="card sitecard" data-id="${esc(s.id)}">
        <span class="avatar" style="background:${esc(s.color || A.TINTS[0])}">${esc(A.initial(s.name))}</span>
        <div class="sitecard__t"><b>${esc(s.name)}</b><small>${esc([s.domain, s.category, A.dot(s.created_at)].filter(Boolean).join(' · '))}</small></div>
        <div class="stages">${['build', 'review', 'live'].map(k => `<button class="s-${k}${s.stage === k ? ' is-on' : ''}" data-stage="${k}">${A.STAGE[k]}</button>`).join('')}</div>
        <button class="btn btn--line btn--sm" data-manage>관리</button></div>`).join('') : '<div class="card empty">아직 만든 사이트가 없습니다.</div>';
    };
    paintList();
    $('#bl').addEventListener('click', async e => {
      const card = e.target.closest('[data-id]'); if (!card) return;
      const id = card.dataset.id, st = e.target.closest('[data-stage]');
      if (e.target.closest('[data-manage]')) return A.go(A.siteHash('settings', id));
      if (st) {
        const { error } = await A.sb.from('sites').update({ stage: st.dataset.stage }).eq('id', id);
        if (error) return A.fail(error);
        A.site(id).stage = st.dataset.stage; paintList(); A.toast(`'${A.site(id).name}' → ${A.STAGE[st.dataset.stage]}`);
      }
    });
  };

  /* =============== 도메인 · 호스팅 =============== */
  V.hosting = async main => {
    await A.loadSites();
    const sites = S.sites.filter(s => s.domain || Object.keys(s.ops || {}).length);
    const alerts = A.opsAlerts(S.sites);
    const soon = S.sites.flatMap(s => ['domainExp', 'hostExp'].map(k => A.dday((s.ops || {})[k]).n)).filter(n => n >= 0 && n <= 30).length;
    const bad = S.sites.filter(s => s.stage !== 'build' && s.ops?.ssl && s.ops.ssl !== 'ok').length + S.sites.flatMap(s => ['domainExp', 'hostExp'].map(k => A.dday((s.ops || {})[k]).n)).filter(n => n < 0).length;
    const cost = S.sites.reduce((a, s) => a + (+(s.ops || {}).cost || 0), 0);
    main.innerHTML = `<div class="ph"><div><h1>도메인 · 호스팅</h1><p class="sub">모든 사이트의 도메인, 호스팅, SSL 만료일을 한곳에서 관리합니다.</p></div></div>
      <div class="grid g4" style="margin-bottom:24px">${A.kpi('관리 도메인', S.sites.filter(s => s.domain).length + '개', 'globe')}${A.kpi('30일 내 만료', soon + '건', 'cal', '', soon ? 'is-warn' : '')}${A.kpi('만료 · SSL 문제', bad + '건', 'shield', '', bad ? 'is-neg' : '')}${A.kpi('월 호스팅 비용', A.n(cost) + '원', 'card')}</div>
      ${alerts.length ? `<div class="card card__pad" style="margin-bottom:24px"><div class="card__h"><h2>확인이 필요한 항목</h2></div>${alerts.map(a => `<div class="alert"><em style="color:${a.c}">${esc(a.kind)}</em><b>${esc(a.title)}</b><span class="t2">${esc(a.date || a.site.domain || '')}</span><small>${esc(a.note)}</small></div>`).join('')}</div>` : ''}
      <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>사이트 · 도메인</th><th>등록기관</th><th>도메인 만료</th><th>호스팅</th><th>호스팅 만료</th><th>SSL</th><th class="r">월 비용</th><th>명의</th><th></th></tr></thead><tbody>
      ${S.sites.map(s => { const o = s.ops || {}, d1 = A.dday(o.domainExp), d2 = A.dday(o.hostExp); return `<tr>
        <td><span class="t-main">${esc(s.name)}</span><span class="t-sub">${esc(s.domain || '도메인 미등록')}</span></td>
        <td>${esc(o.registrar || '-')}</td>
        <td class="nowrap">${o.domainExp ? `${A.dot(o.domainExp)}<span class="t-sub dday ${d1.c}">${d1.t}</span>` : '-'}</td>
        <td>${esc(o.host || '-')}${o.hostPlan ? `<span class="t-sub">${esc(o.hostPlan)}</span>` : ''}</td>
        <td class="nowrap">${o.hostExp ? `${A.dot(o.hostExp)}<span class="t-sub dday ${d2.c}">${d2.t}</span>` : '-'}</td>
        <td>${o.ssl ? `<span class="ssl ssl--${o.ssl}"><i></i>${{ ok: '정상', check: '확인 필요', none: '미설치' }[o.ssl]}</span>` : '-'}</td>
        <td class="r num t-main">${o.cost ? A.n(o.cost) + '원' : '-'}</td>
        <td>${o.owner ? (o.owner === 'studio' ? '스튜디오' : '고객') : '-'}<span class="t-sub" style="color:${o.auto ? 'var(--blue)' : 'var(--t3)'}">${o.auto ? '자동 연장' : '수동 연장'}</span></td>
        <td class="r"><button class="btn btn--xs" data-edit="${esc(s.id)}">수정</button></td></tr>`; }).join('')}
      </tbody></table>${!sites.length ? '<p class="empty">도메인 · 호스팅 정보를 <b>수정</b> 버튼으로 입력하면 만료일 알림을 받을 수 있습니다.</p>' : ''}</div>`;
    main.querySelector('tbody').addEventListener('click', e => { const b = e.target.closest('[data-edit]'); if (b) A.editOps(b.dataset.edit, () => V.hosting(main)); });
  };
  A.editOps = (id, done) => {
    const s = A.site(id), o = { registrar: '', domainExp: '', host: '', hostPlan: '', hostExp: '', ssl: 'ok', cost: 0, owner: 'studio', auto: false, ...(s.ops || {}) };
    const m = A.modal({ title: `${s.name} · 도메인 · 호스팅`, body: `
      <div class="grid g2"><label class="field">도메인<input name="domain" value="${esc(s.domain || '')}" placeholder="example.co.kr"></label><label class="field">등록기관<input name="registrar" value="${esc(o.registrar)}" placeholder="카페24, 가비아…"></label></div>
      <div class="grid g2"><label class="field">도메인 만료일<input type="date" name="domainExp" value="${esc(o.domainExp)}"></label><label class="field">SSL<select name="ssl">${[['ok', '정상'], ['check', '확인 필요'], ['none', '미설치']].map(([v, l]) => `<option value="${v}"${o.ssl === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div class="grid g2"><label class="field">호스팅 업체<input name="host" value="${esc(o.host)}" placeholder="카페24"></label><label class="field">상품명<input name="hostPlan" value="${esc(o.hostPlan)}" placeholder="뉴아우토반 비즈니스"></label></div>
      <div class="grid g2"><label class="field">호스팅 만료일<input type="date" name="hostExp" value="${esc(o.hostExp)}"></label><label class="field">월 비용 (원)<input type="number" min="0" step="500" name="cost" value="${+o.cost || 0}"></label></div>
      <div class="grid g2"><label class="field">명의<select name="owner"><option value="studio"${o.owner === 'studio' ? ' selected' : ''}>스튜디오</option><option value="client"${o.owner === 'client' ? ' selected' : ''}>고객</option></select></label><label class="check" style="align-self:end;padding-bottom:12px"><input type="checkbox" name="auto"${o.auto ? ' checked' : ''}>자동 연장</label></div>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn btn--primary" data-save>저장</button>` });
    m.el.querySelector('[data-save]').onclick = async () => {
      const g = n => m.el.querySelector(`[name=${n}]`);
      const ops = { registrar: g('registrar').value.trim(), domainExp: g('domainExp').value, host: g('host').value.trim(), hostPlan: g('hostPlan').value.trim(), hostExp: g('hostExp').value, ssl: g('ssl').value, cost: +g('cost').value || 0, owner: g('owner').value, auto: g('auto').checked };
      const domain = g('domain').value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') || null;
      const { error } = await A.sb.from('sites').update({ ops, domain }).eq('id', id);
      if (error) return A.fail(error);
      Object.assign(s, { ops, domain }); m.close(); A.toast('저장했습니다.'); A.paintHeader(); done?.();
    };
  };

  /* =============== 관리자 계정 관리 =============== */
  V.accounts = async main => {
    const { data, error } = await A.sb.rpc('list_accounts');
    if (error) return A.fail(error);
    main.innerHTML = `<div class="ph"><div><h1>관리자 계정 관리</h1><p class="sub">스튜디오 운영자와 고객사 담당자 계정을 관리합니다.</p></div></div>
      <div class="g-12" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
      <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>계정</th><th>권한</th><th>관리 사이트</th><th>최근 로그인</th><th></th></tr></thead><tbody>
        ${(data || []).map(u => `<tr><td><span class="t-main">${esc(u.name || u.email.split('@')[0])}</span><span class="t-sub">${esc(u.email)}</span></td>
          <td>${u.role === 'admin' ? '<span class="pill pill--new">운영자</span>' : '<span class="pill">사이트 담당자</span>'}</td>
          <td class="t2">${u.role === 'admin' ? '전체' : esc((u.sites || []).map(id => A.site(id)?.name || id).join(', '))}</td>
          <td class="t2 nowrap">${u.last_sign_in ? A.dtime(u.last_sign_in) : '-'}</td>
          <td class="r">${u.user_id === S.user.id ? '<span class="muted">나</span>' : u.role === 'admin' ? `<button class="btn btn--xs btn--danger" data-off="${esc(u.email)}">운영자 해제</button>` : `<button class="btn btn--xs" data-on="${esc(u.email)}">운영자 지정</button>`}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="stack" style="gap:16px"><form class="card card__pad stack" id="af" style="gap:14px"><h2 style="font-size:18px;font-weight:800">운영자 추가</h2>
        <label class="field">이메일<input name="email" type="email" required placeholder="name@company.com"></label><button class="btn btn--primary">운영자로 지정</button></form>
        <div class="note"><b>새 계정 만들기</b><br>Supabase → Authentication → Users 에서 <b>Invite user</b>(초대) 또는 <b>Add user</b> 로 계정을 먼저 만든 뒤,<br>· 운영자: 여기서 지정<br>· 고객사 담당자: 사이트 설정 → 담당자 계정에서 추가</div></div></div>`;
    const set = async (email, on) => {
      if (!on && !A.confirm(`${email} 의 운영자 권한을 해제할까요?`)) return;
      const { error } = await A.sb.rpc('set_admin', { member_email: email, on_: on });
      if (error) return A.fail(error, error.message.includes('user_not_found') ? '가입된 계정이 아닙니다. Supabase에서 먼저 초대해 주세요.' : '변경하지 못했습니다.');
      A.toast(on ? '운영자로 지정했습니다.' : '운영자 권한을 해제했습니다.'); V.accounts(main);
    };
    main.querySelector('tbody').addEventListener('click', e => { const b = e.target.closest('[data-on],[data-off]'); if (b) set(b.dataset.on || b.dataset.off, !!b.dataset.on); });
    $('#af').addEventListener('submit', e => { e.preventDefault(); set(e.target.email.value.trim(), true); });
  };

  /* =============== 사이트 설정 =============== */
  const split = v => v.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
  V['site:settings'] = async main => {
    if (A.isClient()) return A.go(A.siteHash('dash'));
    await A.loadSites();
    const s = A.site();
    main.innerHTML = `${A.siteHead('사이트 설정')}
      <div class="g-12">
        <form class="card card__pad stack" id="sf" style="gap:16px"><div class="card__h" style="margin:0"><h2>기본 정보</h2></div>
          <div class="grid g2"><label class="field">사이트 이름<input name="name" required maxlength="60" value="${esc(s.name)}"></label><label class="field">사이트 ID <small>홈페이지 코드의 siteId</small><input value="${esc(s.id)}" readonly></label></div>
          <div class="grid g2"><label class="field">도메인<input name="domain" value="${esc(s.domain || '')}" placeholder="example.co.kr"></label><label class="field">담당자<input name="manager" value="${esc(s.manager || '')}" placeholder="담당 디자이너"></label></div>
          <div class="field">템플릿<div class="chips" id="cat">${A.CATS.map(c => `<button type="button" class="chip chip--blue${c === s.category ? ' is-on' : ''}" data-c="${c}">${c}</button>`).join('')}</div></div>
          <div class="field">제작 단계<div class="stages" id="stg">${['build', 'review', 'live'].map(k => `<button type="button" class="s-${k}${s.stage === k ? ' is-on' : ''}" data-stage="${k}">${A.STAGE[k]}</button>`).join('')}</div></div>
          <div class="field">대표 색상<div class="chips" id="clr">${A.TINTS.map(c => `<button type="button" data-clr="${c}" aria-label="${c}" style="width:32px;height:32px;border:0;border-radius:6px;background:${c};box-shadow:${c === s.color ? '0 0 0 2px var(--s1),0 0 0 4px var(--blue)' : 'none'}"></button>`).join('')}</div></div>
          <label class="field">문의 알림 메일 <small>여러 개는 쉼표나 줄바꿈으로 구분</small><textarea name="emails" rows="2" placeholder="owner@client.com">${esc((s.notify_emails || []).join('\n'))}</textarea></label>
          <label class="field">허용 도메인 <small>이 주소에서 온 문의만 받습니다. 비워두면 제한 없음</small><textarea name="origins" rows="2" placeholder="https://client.com">${esc((s.allowed_origins || []).join('\n'))}</textarea></label>
          <label class="field">로봇 방지 사이트 키 <small>Cloudflare Turnstile 'Site Key' — 방문자 글쓰기 · 댓글에 사용</small><input name="turnstile" value="${esc(s.turnstile_key || '')}" placeholder="0x4AAAAAAA…"></label>
          <label class="check"><input type="checkbox" name="active"${s.active ? ' checked' : ''}>사이트 사용 (끄면 문의 접수 · 콘텐츠 제공 중지)</label>
          <div class="row row--sb"><button type="button" class="btn btn--danger btn--sm" id="del">사이트 삭제</button><div class="row"><button type="button" class="btn btn--line btn--sm" id="ops">도메인 · 호스팅</button><button class="btn btn--primary">저장</button></div></div>
        </form>
        <div class="stack" style="gap:16px">
          <div class="card card__pad"><div class="card__h"><h2>게시판</h2></div><ul class="list" id="boards"></ul>
            <form class="row" id="bf" style="margin-top:12px"><input class="inp grow" name="name" placeholder="게시판 이름" required style="min-width:120px"><input class="inp" name="slug" placeholder="주소 (notice)" required pattern="[a-z0-9][a-z0-9\\-]{0,39}" style="width:130px"><select class="inp" name="kind" style="width:auto"><option value="list">일반</option><option value="faq">FAQ</option><option value="gallery">갤러리</option></select><button class="btn btn--sm">추가</button></form></div>
          <div class="card card__pad"><div class="card__h"><h2>담당자 계정</h2></div><p class="muted" style="font-size:12px;margin:-8px 0 8px">로그인하면 이 사이트의 통계 · 콘텐츠 · 문의 · 게시판만 볼 수 있습니다.</p><ul class="list" id="members"></ul>
            <form class="row" id="mf" style="margin-top:12px"><input class="inp grow" name="email" type="email" placeholder="담당자 이메일" required><button class="btn btn--sm">추가</button></form>
            <p class="muted" style="font-size:12px;margin-top:8px">Supabase → Authentication → Users 에서 먼저 초대(Invite)하세요.</p></div>
        </div>
      </div>
      <div class="card card__pad" style="margin-top:16px"><div class="card__h"><h2>홈페이지 설치 코드</h2><small>고객사 홈페이지의 &lt;/body&gt; 바로 앞에 넣으세요</small></div><pre class="code" id="snip"></pre><div class="row" style="margin-top:12px"><button class="btn btn--sm" id="copy">코드 복사</button></div></div>`;
    A.bindHead(main);
    let cat = s.category, stage = s.stage, color = s.color;
    $('#cat').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; $$('#cat .chip').forEach(x => x.classList.toggle('is-on', x === b)); };
    $('#stg').onclick = e => { const b = e.target.closest('[data-stage]'); if (!b) return; stage = b.dataset.stage; $$('#stg button').forEach(x => x.classList.toggle('is-on', x === b)); };
    $('#clr').onclick = e => { const b = e.target.closest('[data-clr]'); if (!b) return; color = b.dataset.clr; $$('#clr button').forEach(x => x.style.boxShadow = x === b ? '0 0 0 2px var(--s1),0 0 0 4px var(--blue)' : 'none'); };
    $('#ops').onclick = () => A.editOps(s.id);
    $('#sf').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target;
      const row = { name: f.name.value.trim(), domain: f.domain.value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') || null, manager: f.manager.value.trim() || null, category: cat, stage, color,
        notify_emails: split(f.emails.value), allowed_origins: split(f.origins.value).map(o => o.replace(/\/+$/, '')), active: f.active.checked, turnstile_key: f.turnstile.value.trim() || null };
      const bad = row.notify_emails.find(m => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)); if (bad) return A.toast(`메일 주소를 확인해 주세요: ${bad}`, true);
      const badO = row.allowed_origins.find(o => !/^https?:\/\/[^/]+$/.test(o)); if (badO) return A.toast(`도메인은 https://example.com 형식으로 입력해 주세요: ${badO}`, true);
      const { error } = await A.sb.from('sites').update(row).eq('id', s.id);
      if (error) return A.fail(error);
      Object.assign(s, row); A.paintSide(); A.paintHeader(); A.toast('저장했습니다.');
    });
    $('#del').onclick = async () => {
      const t = prompt(`사이트를 삭제하면 문의 · 게시판 · 방문 기록이 모두 삭제됩니다.\n계속하려면 사이트 ID(${s.id})를 입력하세요.`);
      if (t !== s.id) return;
      const { error } = await A.sb.from('sites').delete().eq('id', s.id);
      if (error) return A.fail(error);
      await A.loadSites(); A.toast('삭제했습니다.'); A.go('#/build');
    };
    const snippet = `<script src="${A.cfg.clientScript}"><\/script>\n<script>\n  IUXCloud.init({\n    url: '${A.cfg.supabaseUrl}',\n    anonKey: '${A.cfg.anonKey}',\n    siteId: '${s.id}'\n  });\n  // 방문 통계는 자동으로 기록됩니다.\n  // 문의 보내기:  await IUXCloud.sendInquiry({ kind: 'quote', name, phone, email, message })\n  // 게시글 목록:  const { items } = await IUXCloud.listPosts('notice')\n  // 관리자 콘텐츠: const site = await IUXCloud.getSite()\n<\/script>`;
    $('#snip').textContent = snippet;
    $('#copy').onclick = () => navigator.clipboard.writeText(snippet).then(() => A.toast('복사했습니다.'));
    const paintBoards = async () => {
      const { data } = await A.sb.from('boards').select('*').eq('site_id', s.id).order('sort').order('created_at');
      $('#boards').innerHTML = (data || []).length ? data.map(b => `<li><span class="grow"><b>${esc(b.name)}</b><span class="t-sub muted" style="font-size:12px;display:block">${esc(b.slug)} · ${{ list: '일반', faq: 'FAQ', gallery: '갤러리' }[b.kind]}${b.allow_write ? ' · 방문자 글쓰기' : ''}${b.allow_comment ? ' · 댓글' : ''}${b.show_menu ? ' · 메뉴 표시' : ''}</span></span><button class="btn btn--xs" data-cfg="${esc(b.slug)}">설정</button><button class="btn btn--xs btn--danger" data-rm="${esc(b.slug)}">삭제</button></li>`).join('') : '<li class="muted">게시판이 없습니다.</li>';
    };
    $('#boards').onclick = async e => {
      const cfg = e.target.closest('[data-cfg]'), rm = e.target.closest('[data-rm]');
      if (cfg) { const { data } = await A.sb.from('boards').select('*').eq('site_id', s.id).eq('slug', cfg.dataset.cfg).single(); A.boardSettings(data, paintBoards); }
      if (rm) { if (!A.confirm(`'${rm.dataset.rm}' 게시판과 글이 모두 삭제됩니다. 계속할까요?`)) return; const { error } = await A.sb.from('boards').delete().eq('site_id', s.id).eq('slug', rm.dataset.rm); error ? A.fail(error) : paintBoards(); }
    };
    $('#bf').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target;
      const { error } = await A.sb.from('boards').insert({ site_id: s.id, name: f.name.value.trim(), slug: f.slug.value.trim(), kind: f.kind.value });
      if (error) return A.fail(error, error.code === '23505' ? '이미 있는 주소입니다.' : '추가하지 못했습니다.');
      f.reset(); paintBoards();
    });
    const paintMembers = async () => {
      const { data, error } = await A.sb.rpc('list_site_members', { s: s.id });
      if (error) return A.fail(error);
      $('#members').innerHTML = data.length ? data.map(m => `<li><span class="grow">${esc(m.email)}</span><button class="btn btn--xs btn--danger" data-uid="${m.user_id}">해제</button></li>`).join('') : '<li class="muted">등록된 담당자가 없습니다.</li>';
    };
    $('#members').onclick = async e => { const b = e.target.closest('[data-uid]'); if (!b || !A.confirm('이 담당자의 권한을 해제할까요?')) return; const { error } = await A.sb.from('site_members').delete().eq('site_id', s.id).eq('user_id', b.dataset.uid); error ? A.fail(error) : paintMembers(); };
    $('#mf').addEventListener('submit', async e => {
      e.preventDefault();
      const { error } = await A.sb.rpc('add_site_member', { s: s.id, member_email: e.target.email.value });
      if (error) return A.fail(error, error.message.includes('user_not_found') ? '가입된 계정이 아닙니다. Supabase에서 먼저 초대해 주세요.' : '추가하지 못했습니다.');
      e.target.reset(); paintMembers(); A.toast('담당자를 추가했습니다.');
    });
    paintBoards(); paintMembers();
  };

  /* =============== 게시판 설정 (사이트 설정 · 게시판 화면에서 공통 사용) =============== */
  A.boardSettings = (b, done) => {
    const gen = b.kind === 'list';
    const m = A.modal({ title: `${b.name} 게시판 설정`, body: `
      <div class="grid g2"><label class="field">게시판 이름<input name="name" value="${esc(b.name)}" maxlength="30"></label><label class="field">주소 <small>변경 불가</small><input value="${esc(b.slug)}" readonly></label></div>
      <label class="field">종류<select name="kind">${[['list', '일반 게시판'], ['faq', 'FAQ'], ['gallery', '갤러리']].map(([k, l]) => `<option value="${k}"${b.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field">분류 <small>쉼표로 구분 (예: 질문, 후기, 자료). 비워두면 분류 없음</small><input name="cats" value="${esc((b.categories || []).join(', '))}" placeholder="질문, 후기, 자료"></label>
      <div class="note" style="display:flex;flex-direction:column;gap:12px">
        <label class="check"><input type="checkbox" name="w"${b.allow_write ? ' checked' : ''}>방문자 글쓰기 허용 <small class="muted" style="font-weight:400">이름 · 비밀번호로 작성, 비밀번호로 수정 · 삭제</small></label>
        <label class="check"><input type="checkbox" name="c"${b.allow_comment ? ' checked' : ''}>댓글 · 대댓글 허용</label>
        <label class="check"><input type="checkbox" name="m"${b.show_menu ? ' checked' : ''}>홈페이지 메뉴에 표시</label>
        <small class="muted">방문자 글쓰기 · 댓글은 로봇 방지(사이트 설정의 Turnstile 키)가 있어야 동작합니다.</small></div>
      <p class="muted" style="font-size:12px">홈페이지 주소: <code>board.html?b=${esc(b.slug)}</code></p>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn btn--primary" data-save>저장</button>` });
    void gen;
    m.el.querySelector('[data-save]').onclick = async () => {
      const g = n => m.el.querySelector(`[name=${n}]`);
      const row = { name: g('name').value.trim() || b.name, kind: g('kind').value, categories: g('cats').value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 20), allow_write: g('w').checked, allow_comment: g('c').checked, show_menu: g('m').checked };
      const { error } = await A.sb.from('boards').update(row).eq('site_id', b.site_id).eq('slug', b.slug);
      if (error) return A.fail(error);
      m.close(); A.toast('게시판 설정을 저장했습니다.'); done?.();
    };
  };

  /* =============== 내 정보 · 비밀번호 =============== */
  V['dlg:me'] = () => {
    const md = S.user.user_metadata || {};
    const m = A.modal({ title: '내 정보 수정', body: `<label class="field">이메일<input value="${esc(S.user.email)}" readonly></label><label class="field">이름<input name="name" value="${esc(md.name || '')}" placeholder="홍길동" maxlength="30"></label><label class="field">연락처<input name="phone" value="${esc(md.phone || '')}" placeholder="010-0000-0000" maxlength="20"></label>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn btn--primary" data-save>저장</button>` });
    m.el.querySelector('[data-save]').onclick = async () => {
      const { data, error } = await A.sb.auth.updateUser({ data: { name: m.el.querySelector('[name=name]').value.trim(), phone: m.el.querySelector('[name=phone]').value.trim() } });
      if (error) return A.fail(error);
      S.user = data.user; m.close(); A.paintHeader(); A.toast('저장했습니다.');
    };
  };
  V['dlg:pw'] = () => {
    const m = A.modal({ title: '비밀번호 변경', body: `<label class="field">새 비밀번호 <small>8자 이상</small><input type="password" name="a" minlength="8" autocomplete="new-password"></label><label class="field">새 비밀번호 확인<input type="password" name="b" autocomplete="new-password"></label>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn btn--primary" data-save>변경</button>` });
    m.el.querySelector('[data-save]').onclick = async () => {
      const a = m.el.querySelector('[name=a]').value, b = m.el.querySelector('[name=b]').value;
      if (a.length < 8) return A.toast('8자 이상 입력해 주세요.', true);
      if (a !== b) return A.toast('두 비밀번호가 다릅니다.', true);
      const { error } = await A.sb.auth.updateUser({ password: a });
      if (error) return A.fail(error);
      m.close(); A.toast('비밀번호를 변경했습니다.');
    };
  };
})();
