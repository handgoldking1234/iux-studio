-- IUX.STUDIO 홈페이지 주소 이전: iux-studio.vercel.app → studio.iux.kr
-- SQL Editor 에서 한 번 실행하세요. (여러 번 실행해도 안전)
-- 옛 주소(iux-studio.vercel.app)도 당분간 열려 있으므로 허용 도메인에는 새 주소를 추가만 합니다.
update public.sites set
  domain          = 'studio.iux.kr',
  content         = replace(content::text, 'https://iux-studio.vercel.app', 'https://studio.iux.kr')::jsonb,
  seo             = replace(seo::text, 'https://iux-studio.vercel.app', 'https://studio.iux.kr')::jsonb,
  allowed_origins = case when 'https://studio.iux.kr' = any(coalesce(allowed_origins, '{}'))
                         then allowed_origins
                         else array_append(coalesce(allowed_origins, '{}'), 'https://studio.iux.kr') end
where id = 'iux-studio';

-- 작업 사례(works) 링크·이미지 주소도 새 도메인으로
update public.sites set
  content = replace(content::text, 'https://iux-studio.vercel.app', 'https://studio.iux.kr')::jsonb
where content::text like '%https://iux-studio.vercel.app%';
