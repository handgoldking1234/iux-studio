-- IUX.STUDIO 홈페이지 주소 이전: handgoldking1234.github.io/iux-studio → iux-studio.vercel.app
-- SQL Editor 에서 한 번 실행하세요. (여러 번 실행해도 안전)
update public.sites set
  domain          = 'iux-studio.vercel.app',
  content         = replace(content::text, 'https://handgoldking1234.github.io/iux-studio', 'https://iux-studio.vercel.app')::jsonb,
  seo             = replace(seo::text, 'https://handgoldking1234.github.io/iux-studio', 'https://iux-studio.vercel.app')::jsonb,
  ops             = case when ops->>'host' = 'GitHub Pages' then ops || '{"host": "Vercel"}'::jsonb else ops end,
  allowed_origins = array_replace(allowed_origins, 'https://handgoldking1234.github.io', 'https://iux-studio.vercel.app')
where id = 'iux-studio';
