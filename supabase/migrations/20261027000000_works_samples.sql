-- 포트폴리오(works)에 샘플 사이트 연결: IUX Holdings 링크 + IUX성형외과 · 미소치과의원 추가
-- 이미지가 있는 마지막 항목 뒤에 넣고, 자리 표시용 '샘플 04' · '샘플 05' 는 뺍니다.
-- SQL Editor 에서 한 번 실행하세요. (여러 번 실행해도 안전)
with w as (
  select o, case when x->>'name' = 'IUX Holdings' and coalesce(x->>'link', '') = ''
                 then x || '{"link": "https://iux-studio.vercel.app/samples/iux-holdings/"}'::jsonb else x end as x
  from public.sites s, jsonb_array_elements(s.content->'works') with ordinality t(x, o)
  where s.id = 'iux-studio' and x->>'name' not in ('IUX성형외과', '미소치과의원', '샘플 04', '샘플 05')
), pos as (
  select coalesce(max(o) filter (where coalesce(x->>'img', '') <> ''), 0) as p from w
), n(x, k) as (values
  ('{"name": "IUX성형외과", "cat": "병원", "img": "https://iux-studio.vercel.app/assets/img/work-iux-plastic-surgery.jpg", "link": "https://iux-studio.vercel.app/samples/iux-plastic-surgery/"}'::jsonb, 1),
  ('{"name": "미소치과의원", "cat": "병원", "img": "https://iux-studio.vercel.app/assets/img/work-miso-dental.jpg", "link": "https://iux-studio.vercel.app/samples/miso-dental/"}'::jsonb, 2)
)
update public.sites set content = jsonb_set(content, '{works}', (
  select coalesce(jsonb_agg(x order by ord), '[]'::jsonb)
  from (select x, o::numeric as ord from w union all select n.x, pos.p + n.k * 0.1 from n, pos) z
))
where id = 'iux-studio' and jsonb_typeof(content->'works') = 'array';
