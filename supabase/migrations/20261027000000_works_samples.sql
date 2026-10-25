-- 포트폴리오(works)에 샘플 사이트 연결: IUX SYSTEM · IUX Holdings 링크 + IUX성형외과 · 미소치과의원 · 이음새 추가
-- IUX Holdings 바로 뒤(없으면 이미지가 있는 마지막 항목 뒤)에 넣고,
-- 자리 표시용 '샘플 04' · '샘플 05' · '샘플 06', '암갈색의 경성' 과 관리자에서 만든 빈 '새 프로젝트'(링크 없음)는 뺍니다.
-- SQL Editor 에서 한 번 실행하세요. (여러 번 실행해도 안전)
with w as (
  select o, case when coalesce(x->>'link', '') <> '' then x
                 when x->>'name' = 'IUX Holdings' then x || '{"link": "https://iux-studio.vercel.app/samples/?s=iux-holdings"}'::jsonb
                 when x->>'name' = 'IUX SYSTEM' then x || '{"link": "https://iux-studio.vercel.app/samples/?s=iux-system"}'::jsonb
                 else x end as x
  from public.sites s, jsonb_array_elements(s.content->'works') with ordinality t(x, o)
  where s.id = 'iux-studio'
    and x->>'name' not in ('IUX성형외과', '미소치과의원', '이음새', '샘플 04', '샘플 05', '샘플 06', '암갈색의 경성')
    and not (x->>'name' = '새 프로젝트' and coalesce(x->>'link', '') = '')
), pos as (
  select coalesce(max(o) filter (where x->>'name' = 'IUX Holdings'), max(o) filter (where coalesce(x->>'img', '') <> ''), 0) as p from w
), n(x, k) as (values
  ('{"name": "IUX성형외과", "cat": "병원", "img": "https://iux-studio.vercel.app/assets/img/work-iux-plastic-surgery.jpg", "link": "https://iux-studio.vercel.app/samples/?s=iux-plastic-surgery"}'::jsonb, 1),
  ('{"name": "미소치과의원", "cat": "병원", "img": "https://iux-studio.vercel.app/assets/img/work-miso-dental.jpg", "link": "https://iux-studio.vercel.app/samples/?s=miso-dental"}'::jsonb, 2),
  ('{"name": "이음새", "cat": "기업", "img": "https://iux-studio.vercel.app/assets/img/work-ieumsae.jpg", "link": "https://iux-studio.vercel.app/samples/?s=ieumsae"}'::jsonb, 3)
)
update public.sites set content = jsonb_set(content, '{works}', (
  select coalesce(jsonb_agg(x order by ord), '[]'::jsonb)
  from (select x, o::numeric as ord from w union all select n.x, pos.p + n.k * 0.1 from n, pos) z
))
where id = 'iux-studio' and jsonb_typeof(content->'works') = 'array';
