/* 사이트 통계: 대시보드 · 유입/검색어 · 기기/OS · 이탈 분석 */
(() => {
  'use strict';
  const { $, esc, I, S } = A;
  const V = A.views;
  const cache = new Map();

  async function stats(range) {
    const key = `${S.siteId}|${range.from.toISOString()}|${range.to.toISOString()}`;
    if (cache.has(key) && Date.now() - cache.get(key).t < 60000) return cache.get(key).d;
    const { data, error } = await A.sb.rpc('site_stats', { s: S.siteId, d_from: range.from.toISOString(), d_to: range.to.toISOString() });
    if (error) throw error;
    cache.set(key, { t: Date.now(), d: data }); return data;
  }
  const both = () => Promise.all([stats(A.range()), stats(A.prevRange())]);

  /* 경로 → 사람이 읽는 이름 */
  const BASE = { '/': '메인', '/index.html': '메인', '/notice.html': '공지사항', '/faq.html': '자주 묻는 질문', '/page.html': '서브 페이지' };
  const namer = st => {
    const m = {};
    (st.pages || []).forEach(p => { if (p.title) m[p.path] = p.title.split(/ [—|-] /)[0].trim(); });
    return path => BASE[path] || m[path] || path;
  };

  const frame = async (main, title, body) => {
    main.innerHTML = `${A.siteHead(title, { extra: A.periodHTML() })}<div id="sv"><p class="loading">불러오는 중…</p></div>`;
    A.bindHead(main); A.bindPeriod(main, () => A.route());
    const s = A.site();
    if (s?.stage === 'build') {
      $('#sv').innerHTML = `<div class="card empty">아직 제작 중인 사이트입니다.<br>홈페이지에 설치 코드를 넣고 공개하면 방문 통계가 쌓이기 시작합니다.</div>`;
    }
    try { const [cur, prev] = await both(); if (s?.stage === 'build' && !cur.pageviews) return; $('#sv').innerHTML = body(cur, prev); }
    catch (e) { $('#sv').innerHTML = `<div class="card empty">통계를 불러오지 못했습니다.<br><small>${esc(e.message)}</small></div>`; }
  };
  const noData = st => !st.pageviews ? `<div class="note" style="margin-bottom:16px">아직 이 기간에 기록된 방문이 없습니다. 홈페이지에 방문이 생기면 자동으로 집계됩니다.</div>` : '';

  /* 방문자 추이 막대 */
  const chart = st => {
    const r = A.range(), days = Math.round((r.to - r.from) / 864e5), map = Object.fromEntries((st.daily || []).map(x => [x.d, x.v]));
    const list = Array.from({ length: days }, (_, i) => { const d = new Date(r.from.getTime() + i * 864e5); return { d, v: map[A.ymd(d)] || 0 }; });
    const max = Math.max(...list.map(x => x.v), 1);
    return `<div class="chart">${list.map(x => `<div class="chart__b" style="height:${Math.max(1, x.v / max * 100)}%" data-tip="${A.md_(x.d)} · ${A.n(x.v)}명"></div>`).join('')}</div>
      <div class="chart__x"><span>${A.md_(list[0].d)}</span><span>${A.md_(list[Math.floor(list.length / 2)].d)}</span><span>${A.md_(list[list.length - 1].d)}</span></div>`;
  };
  const srcRows = st => (st.sources || []).map(x => ({ label: A.SRC[x.k] || x.k, v: x.v }));
  const DEV_C = { mobile: 'var(--blue)', pc: 'var(--t2)', tablet: 'var(--warn)' };
  const devices = st => { const sum = (st.devices || []).reduce((a, x) => a + x.v, 0); return ['mobile', 'pc', 'tablet'].map(k => { const v = (st.devices || []).find(x => x.k === k)?.v || 0; return { k, label: A.DEV[k], v, p: A.pct(v, sum) }; }); };

  V['site:dash'] = main => frame(main, '대시보드', (c, p) => {
    const name = namer(c), dv = devices(c);
    const exits = (c.pages || []).filter(x => x.views >= 1).map(x => ({ ...x, rate: A.pct(x.exits, x.views) })).sort((a, b) => b.rate - a.rate).slice(0, 4);
    return `${noData(c)}<div class="grid g5" style="margin-bottom:24px">
      ${A.kpi('방문자', A.n(c.visitors), 'users', A.delta(c.visitors, p.visitors))}
      ${A.kpi('페이지뷰', A.n(c.pageviews), 'eye', A.delta(c.pageviews, p.pageviews))}
      ${A.kpi('평균 체류시간', A.dur(c.avg_ms).replace(/^0분 /, ''), 'clock', A.delta(c.avg_ms, p.avg_ms))}
      ${A.kpi('이탈률', c.bounce + '%', 'exit', p.visitors ? A.delta(c.bounce, p.bounce, '%p', true) : '')}
      ${A.kpi('상담 문의', A.n(c.inquiries) + '건', 'inq', A.delta(c.inquiries, p.inquiries))}</div>
      <div class="card card__pad" style="margin-bottom:24px"><div class="card__h"><h2>방문자 추이</h2><small>막대에 올리면 날짜별 수치</small></div>${chart(c)}</div>
      <div class="grid g3" style="gap:16px">
        <div class="card card__pad"><div class="card__h"><h2>유입 경로</h2></div>${A.barsHTML(srcRows(c))}</div>
        <div class="card card__pad"><div class="card__h"><h2>기기</h2></div><div class="stack-bar">${dv.filter(x => x.v).map(x => `<i style="width:${x.p}%;background:${DEV_C[x.k]}"></i>`).join('')}</div>
          <div class="legend">${dv.map(x => `<div><i style="background:${DEV_C[x.k]}"></i><b style="text-align:left">${x.label}</b><span>${A.n(x.v)}</span><b>${x.p}%</b></div>`).join('')}</div></div>
        <div class="card card__pad"><div class="card__h"><h2>많이 나간 페이지</h2><a href="${A.siteHash('exit')}" class="linkbtn">전체 보기</a></div>
          ${exits.length ? `<div class="kv">${exits.map(x => `<div><b>${esc(name(x.path))}</b><span class="is-neg">${x.rate}%</span></div>`).join('')}</div>` : '<p class="empty">아직 데이터가 없습니다.</p>'}</div>
      </div>`;
  });

  V['site:traffic'] = main => frame(main, '유입 · 검색어', c => {
    const kw = c.keywords || [], max = Math.max(...kw.map(x => x.v), 1);
    return `${noData(c)}<div class="g-12" style="margin-bottom:24px">
      <div class="card card__pad"><div class="card__h"><h2>유입 채널</h2></div>${A.barsHTML(srcRows(c))}</div>
      <div class="card card__pad"><div class="card__h"><h2>추천 사이트</h2></div>${(c.refs || []).length ? `<div class="kv">${c.refs.map(x => `<div><b>${esc(x.k)}</b><span>${A.n(x.v)}</span></div>`).join('')}</div>` : '<p class="empty">다른 사이트에서 들어온 방문이 아직 없습니다.</p>'}</div></div>
      <div class="card"><div class="card__pad" style="padding-bottom:0"><div class="card__h"><h2>검색어</h2><small>광고 · 캠페인 링크의 검색어(utm_term) 기준</small></div></div>
      ${kw.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>검색어</th><th>검색엔진</th><th class="r">유입</th><th style="width:30%">비율</th><th class="r">문의 전환</th></tr></thead><tbody>
        ${kw.map((x, i) => `<tr><td class="muted">${i + 1}</td><td class="t-main">${esc(x.k)}</td><td class="t2">${esc((A.SRC[x.src] || x.src || '-').replace(' 검색', ''))}</td><td class="r num">${A.n(x.v)}</td><td><div class="bar__track" style="margin:0"><i style="width:${x.v / max * 100}%"></i></div></td><td class="r t-main">${A.pct(x.conv, x.v)}%</td></tr>`).join('')}
        </tbody></table></div>`
      : `<div class="card__pad"><div class="note">네이버 · 구글은 검색어를 사이트에 넘겨주지 않아 자연 검색어는 여기서 집계되지 않습니다.<br>
        · <b>자연 검색어</b>: <a href="https://searchadvisor.naver.com" target="_blank" rel="noopener" style="color:var(--blue)">네이버 서치어드바이저</a>, <a href="https://search.google.com/search-console" target="_blank" rel="noopener" style="color:var(--blue)">구글 서치콘솔</a>에서 확인 (SEO 관리에서 인증 코드 등록)<br>
        · <b>광고 · 캠페인</b>: 링크 끝에 <code>?utm_source=naver&utm_term=검색어</code> 를 붙이면 이 표에 검색어별 유입과 문의 전환이 집계됩니다.</div></div>`}</div>`;
  });

  V['site:device'] = main => frame(main, '기기 · OS', c => {
    const dv = devices(c), rows = k => (c[k] || []).map(x => ({ label: x.k, v: x.v }));
    const scr = c.screens || [], ssum = scr.reduce((a, x) => a + x.v, 0);
    return `${noData(c)}<div class="grid g3" style="margin-bottom:24px;gap:16px">${dv.map(x => `<div class="card kpi kpi--dot"><div><p><i style="background:${DEV_C[x.k]}"></i>${x.label}</p><b>${x.p}%</b><small>${A.n(x.v)}명</small></div></div>`).join('')}</div>
      <div class="grid g3" style="gap:16px">
        <div class="card card__pad"><div class="card__h"><h2>운영체제</h2></div>${A.barsHTML(rows('os'))}</div>
        <div class="card card__pad"><div class="card__h"><h2>브라우저</h2></div>${A.barsHTML(rows('browsers'), { grey: true })}</div>
        <div class="card card__pad"><div class="card__h"><h2>화면 해상도</h2></div>${scr.length ? `<div class="kv">${scr.map(x => `<div><b>${esc(x.k.replace('x', '×'))}</b><span>${A.pct(x.v, ssum)}%</span></div>`).join('')}</div>` : '<p class="empty">아직 데이터가 없습니다.</p>'}</div>
      </div>`;
  });

  V['site:exit'] = main => frame(main, '이탈 분석', c => {
    const name = namer(c), pages = (c.pages || []).map(x => ({ ...x, rate: A.pct(x.exits, x.views) })).sort((a, b) => b.rate - a.rate);
    const flows = c.flows || [], fsum = flows.reduce((a, x) => a + x.v, 0);
    return `${noData(c)}<div class="card" style="margin-bottom:24px"><div class="card__pad" style="padding-bottom:0"><div class="card__h"><div><h2>이탈 페이지</h2><p>방문자가 사이트를 떠나기 직전 마지막으로 본 페이지</p></div></div></div>
      ${pages.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>페이지</th><th class="r">조회</th><th class="r">이탈</th><th style="width:28%">이탈률</th><th class="r">평균 체류</th></tr></thead><tbody>
        ${pages.map(x => `<tr><td><span class="t-main">${esc(name(x.path))}</span><span class="t-sub">${esc(x.path)}</span></td><td class="r num">${A.n(x.views)}</td><td class="r num">${A.n(x.exits)}</td>
          <td><div class="row" style="flex-wrap:nowrap;gap:16px"><div class="bar__track grow" style="margin:0"><i class="is-neg" style="width:${x.rate}%"></i></div><b style="min-width:44px;text-align:right">${x.rate}%</b></div></td><td class="r t2 nowrap">${A.dur(x.avg_ms)}</td></tr>`).join('')}
        </tbody></table></div>` : '<p class="empty">아직 데이터가 없습니다.</p>'}</div>
      <div class="card card__pad"><div class="card__h"><div><h2>이탈까지의 경로</h2><p>가장 많이 나타난 방문 흐름 (처음 본 3개 페이지)</p></div></div>
        ${flows.length ? flows.map(f => `<div class="flow"><div class="flow__steps">${f.flow.map(p => `<span>${esc(name(p))}</span><i>→</i>`).join('')}<span class="is-exit">이탈</span></div><div class="flow__n"><span>${A.n(f.v)}</span><small>${A.pct(f.v, fsum)}%</small></div></div>`).join('') : '<p class="empty">아직 데이터가 없습니다.</p>'}</div>`;
  });
})();
