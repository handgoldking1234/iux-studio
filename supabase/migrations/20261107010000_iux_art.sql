-- IUX ART (art.iux.kr) 를 IUX Cloud 사이트로 등록
-- SQL Editor 에서 한 번 실행하세요. (여러 번 실행해도 안전)
--  · 방문 통계 · 문의함 · 게시판(새소식)을 studio.iux.kr 관리자에서 관리
--  · 사이트 메뉴 '운영 앱' → IUX ART 전용 관리자(공고 · 작가 · 정산)로 바로 로그인
--  · IUX ART 운영 데이터는 같은 DB의 iuxart 스키마에 따로 저장됩니다 (art.iux.kr 서버가 처음 실행될 때 자동 생성)
insert into public.sites (id, name, category, domain, stage, color, notify_emails, allowed_origins, ops)
values (
  'iux-art', 'IUX ART', '출장 이벤트', 'art.iux.kr', 'live', '#FFC800',
  array['art@iux.kr'],
  array['https://art.iux.kr', 'https://iux-art.vercel.app'],
  jsonb_build_object('appAdmin', 'https://art.iux.kr', 'host', 'Vercel', 'registrar', '가비아', 'ssl', 'ok', 'owner', 'studio')
)
on conflict (id) do update set
  domain          = excluded.domain,
  notify_emails   = case when cardinality(public.sites.notify_emails) = 0 then excluded.notify_emails else public.sites.notify_emails end,
  allowed_origins = (select array(select distinct unnest(public.sites.allowed_origins || excluded.allowed_origins))),
  ops             = public.sites.ops || jsonb_build_object('appAdmin', 'https://art.iux.kr');

-- 새소식 게시판 (홈페이지 '새소식' 메뉴와 연결)
insert into public.boards (site_id, slug, name, kind) values ('iux-art', 'notice', '새소식', 'list') on conflict do nothing;
