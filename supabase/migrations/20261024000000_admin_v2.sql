-- =========================================================
-- IUX Cloud v2 : 슈퍼 어드민 (사이트 제작 · 도메인/호스팅 · 콘텐츠 · SEO · 방문 통계)
-- Supabase > SQL Editor 에 전체를 붙여넣고 Run (한 번만)
-- =========================================================

-- ---------- 사이트 정보 확장 ----------
alter table public.sites
  add column if not exists category text not null default '기업',
  add column if not exists domain   text,
  add column if not exists stage    text not null default 'live',
  add column if not exists manager  text,
  add column if not exists color    text,
  add column if not exists content  jsonb not null default '{}',   -- 메인 · 서브 페이지 · 팝업 · 회사 정보
  add column if not exists seo      jsonb not null default '{}',   -- 페이지별 SEO · 인증 코드
  add column if not exists ops      jsonb not null default '{}',   -- 도메인 · 호스팅 · SSL
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.sites add constraint sites_stage_check check (stage in ('build', 'review', 'live'));
exception when duplicate_object then null; end $$;

drop trigger if exists sites_touch on public.sites;
create trigger sites_touch before update on public.sites for each row execute function public.touch_updated_at();

-- 고객사 담당자는 콘텐츠 · SEO 만 수정 가능 (이름 · 도메인 · 단계 등은 운영자만)
create or replace function public.guard_site_update() returns trigger language plpgsql as $$
begin
  -- SQL Editor · 서버(auth.uid 없음)와 운영자는 통과
  if auth.uid() is not null and not public.is_admin() then
    if (new.id, new.name, new.category, new.domain, new.stage, new.manager, new.color, new.notify_emails, new.allowed_origins, new.active, new.ops)
       is distinct from (old.id, old.name, old.category, old.domain, old.stage, old.manager, old.color, old.notify_emails, old.allowed_origins, old.active, old.ops) then
      raise exception 'forbidden';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sites_guard on public.sites;
create trigger sites_guard before update on public.sites for each row execute function public.guard_site_update();

drop policy if exists sites_write on public.sites;
create policy sites_insert on public.sites for insert to authenticated with check (is_admin());
create policy sites_delete on public.sites for delete to authenticated using (is_admin());
create policy sites_update on public.sites for update to authenticated using (can_manage(id)) with check (can_manage(id));

update public.sites set color = coalesce(color, '#1d4a3a') where id = 'iux-studio';

-- ---------- 문의 상태 확장 · 유입 경로 ----------
alter table public.inquiries drop constraint if exists inquiries_status_check;
alter table public.inquiries add constraint inquiries_status_check
  check (status in ('new', 'progress', 'quote', 'contract', 'hold', 'done', 'spam'));
alter table public.inquiries add column if not exists source text;   -- 유입 경로 (naver · google · direct ...)
alter table public.inquiries add column if not exists sid text;      -- 방문 기록과 연결 (검색어별 문의 전환 계산)

-- ---------- 방문 기록 ----------
create table if not exists public.pageviews (
  id         bigint generated always as identity primary key,
  site_id    text not null references public.sites on delete cascade on update cascade,
  sid        text not null,              -- 방문(세션) 식별자. 개인 식별 정보 없음
  path       text not null,
  title      text,
  ref_host   text,
  source     text,                        -- naver · google · direct · instagram ...
  keyword    text,                        -- utm_term 등 (있을 때만)
  device     text,                        -- mobile · pc · tablet
  os         text,
  browser    text,
  screen     text,
  duration   int not null default 0,      -- 머문 시간(ms)
  created_at timestamptz not null default now()
);
create index if not exists pageviews_site_time on public.pageviews (site_id, created_at);
create index if not exists pageviews_sid on public.pageviews (sid, created_at);
alter table public.pageviews enable row level security;
drop policy if exists pv_read on public.pageviews;
create policy pv_read on public.pageviews for select to authenticated using (can_manage(site_id));
grant select on public.pageviews to authenticated;
grant all on public.pageviews to service_role;

-- 방문 기록 남기기 (홈페이지에서 호출)
create or replace function public.track(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare s text := left(p->>'site', 40); new_id bigint;
begin
  if not exists (select 1 from sites where id = s and active) then return null; end if;
  -- 같은 방문에서 1분에 60회 이상이면 무시
  if (select count(*) from pageviews where sid = left(p->>'sid', 64) and created_at > now() - interval '1 minute') >= 60 then return null; end if;
  insert into pageviews (site_id, sid, path, title, ref_host, source, keyword, device, os, browser, screen)
  values (s, left(p->>'sid', 64), left(coalesce(p->>'path', '/'), 300), left(p->>'title', 200), left(p->>'ref', 120),
          left(p->>'source', 30), left(p->>'kw', 100), left(p->>'device', 10), left(p->>'os', 20), left(p->>'browser', 30), left(p->>'screen', 15))
  returning id into new_id;
  return new_id;
end $$;

-- 머문 시간 갱신
create or replace function public.track_time(p_id bigint, p_sid text, p_ms int) returns void
language sql security definer set search_path = public as $$
  update pageviews set duration = least(greatest(p_ms, 0), 3600000)
  where id = p_id and sid = p_sid and created_at > now() - interval '6 hours';
$$;

grant execute on function public.track(jsonb), public.track_time(bigint, text, int) to anon, authenticated;

-- ---------- 통계 ----------
create or replace function public.site_stats(s text, d_from timestamptz, d_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not can_manage(s) then raise exception 'forbidden'; end if;
  with pv as (
    select * from pageviews where site_id = s and created_at >= d_from and created_at < d_to
  ), ses as (
    select sid, count(*) n, sum(duration) dur, min(created_at) t0,
           (array_agg(path order by created_at desc))[1] exit_path,
           (array_agg(path order by created_at))[1:3] flow,
           (array_agg(source order by created_at))[1] src,
           (array_agg(device order by created_at))[1] device
    from pv group by sid
  )
  select jsonb_build_object(
    'visitors', (select count(*) from ses),
    'pageviews', (select count(*) from pv),
    'avg_ms', coalesce((select avg(dur)::bigint from ses), 0),
    'bounce', coalesce((select round(100.0 * count(*) filter (where n = 1) / nullif(count(*), 0), 1) from ses), 0),
    'inquiries', (select count(*) from inquiries where site_id = s and status <> 'spam' and created_at >= d_from and created_at < d_to),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'v', v) order by d) from (
        select to_char(t0 at time zone 'Asia/Seoul', 'YYYY-MM-DD') d, count(*) v from ses group by 1) x), '[]'),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'v', v) order by v desc) from (
        select coalesce(src, 'direct') k, count(*) v from ses group by 1) x), '[]'),
    'refs', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'v', v) order by v desc) from (
        select ref_host k, count(distinct sid) v from pv where ref_host is not null and ref_host <> '' group by 1 order by 2 desc limit 8) x), '[]'),
    'keywords', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'src', src, 'v', v, 'conv', conv) order by v desc) from (
        select p.keyword k, max(p.source) src, count(distinct p.sid) v,
               count(distinct p.sid) filter (where exists (select 1 from inquiries i where i.site_id = s and i.sid = p.sid)) conv
        from pv p where p.keyword is not null and p.keyword <> '' group by 1 order by 3 desc limit 20) x), '[]'),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'v', v) order by v desc) from (
        select coalesce(device, 'pc') k, count(*) v from ses group by 1) x), '[]'),
    'os', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'v', v) order by v desc) from (
        select coalesce(os, '기타') k, count(distinct sid) v from pv group by 1 order by 2 desc limit 6) x), '[]'),
    'browsers', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'v', v) order by v desc) from (
        select coalesce(browser, '기타') k, count(distinct sid) v from pv group by 1 order by 2 desc limit 6) x), '[]'),
    'screens', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'v', v) order by v desc) from (
        select coalesce(screen, '기타') k, count(distinct sid) v from pv group by 1 order by 2 desc limit 6) x), '[]'),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'title', title, 'views', views, 'exits', exits, 'avg_ms', avg_ms) order by views desc) from (
        select p.path, max(p.title) title, count(*) views,
               (select count(*) from ses where exit_path = p.path) exits,
               avg(p.duration)::bigint avg_ms
        from pv p group by p.path order by 3 desc limit 12) x), '[]'),
    'flows', coalesce((select jsonb_agg(jsonb_build_object('flow', flow, 'v', v) order by v desc) from (
        select to_jsonb(flow) flow, count(*) v from ses where n >= 1 group by flow order by 2 desc limit 6) x), '[]')
  ) into r;
  return r;
end $$;

-- 전체 현황 (로그인한 사람이 관리하는 사이트 전체)
create or replace function public.overview_stats(d_from timestamptz, d_to timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'visitors', (select count(distinct sid) from pageviews p where p.site_id = s.id and p.created_at >= d_from and p.created_at < d_to),
    'inquiries', (select count(*) from inquiries i where i.site_id = s.id and i.status <> 'spam' and i.created_at >= d_from and i.created_at < d_to),
    'new_inquiries', (select count(*) from inquiries i where i.site_id = s.id and i.status = 'new'),
    'bounce', (select round(100.0 * count(*) filter (where n = 1) / nullif(count(*), 0), 1)
               from (select count(*) n from pageviews p where p.site_id = s.id and p.created_at >= d_from and p.created_at < d_to group by sid) x)
  )), '[]')
  from sites s where can_manage(s.id);
$$;
revoke execute on function public.site_stats(text, timestamptz, timestamptz), public.overview_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.site_stats(text, timestamptz, timestamptz), public.overview_stats(timestamptz, timestamptz) to authenticated;

-- ---------- 홈페이지가 읽는 공개 콘텐츠 ----------
create or replace function public.site_public(s text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', name, 'content', content,
           'seo', seo - 'notes')
  from sites where id = s and active;
$$;
grant execute on function public.site_public(text) to anon, authenticated;

-- ---------- 관리자 계정 ----------
create or replace function public.list_accounts() returns table (user_id uuid, email text, name text, role text, sites text[], last_sign_in timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query
    select u.id, u.email::text, (u.raw_user_meta_data->>'name')::text,
           case when a.user_id is not null then 'admin' else 'member' end,
           coalesce((select array_agg(m.site_id) from site_members m where m.user_id = u.id), '{}'),
           u.last_sign_in_at
    from auth.users u left join admins a on a.user_id = u.id
    where a.user_id is not null or exists (select 1 from site_members m where m.user_id = u.id)
    order by (a.user_id is null), u.created_at;
end $$;

create or replace function public.set_admin(member_email text, on_ boolean) returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(member_email));
  if uid is null then raise exception 'user_not_found'; end if;
  if not on_ and uid = auth.uid() then raise exception 'cannot_remove_self'; end if;
  if on_ then insert into admins (user_id) values (uid) on conflict do nothing;
  else delete from admins where user_id = uid; end if;
end $$;
revoke execute on function public.list_accounts(), public.set_admin(text, boolean) from public, anon;
grant execute on function public.list_accounts(), public.set_admin(text, boolean) to authenticated;

-- ---------- 고객사 → 스튜디오 요청 (고객센터 · 연장 요청) ----------
create or replace function public.request_support(s text, kind text, msg text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare u record;
begin
  if not can_manage(s) then raise exception 'forbidden'; end if;
  select email, raw_user_meta_data->>'name' nm, raw_user_meta_data->>'phone' ph into u from auth.users where id = auth.uid();
  insert into inquiries (site_id, kind, name, email, phone, subject, message, source)
  values ('iux-studio', 'etc', coalesce(u.nm, u.email), u.email, u.ph,
          '[' || coalesce((select name from sites where id = s), s) || '] ' || left(kind, 40), left(msg, 3000), 'admin');
end $$;
revoke execute on function public.request_support(text, text, text) from public, anon;
grant execute on function public.request_support(text, text, text) to authenticated;

-- ---------- IUX.STUDIO 기본 콘텐츠 (비어 있을 때만) ----------
update public.sites set
  content = case when content = '{}'::jsonb then $json${"hero": [{"cat": "기업 홈페이지", "title": "첫인상으로\n신뢰를 얻는 얼굴", "desc": "회사 소개를 나열하지 않고, 고객이 찾는 강점을 첫 화면에 세웁니다.", "img": "https://iux-studio.vercel.app/assets/img/work-iux-holdings.jpg"}, {"cat": "브랜드 사이트", "title": "브랜드의 분위기를\n온전히 담는 공간", "desc": "컬러, 모션, 문장까지 브랜드의 톤으로 맞춰 기억에 남게 만듭니다.", "img": "https://iux-studio.vercel.app/assets/img/work-gyeongseong.jpg"}, {"cat": "반응형 리뉴얼", "title": "낡은 사이트에\n새 숨을 불어넣다", "desc": "PC부터 모바일까지, 가볍고 빠르게 열리는 구조로 다시 설계합니다.", "img": "https://iux-studio.vercel.app/assets/img/work-iux-system.jpg"}], "works": [{"name": "암갈색의 경성", "cat": "브랜드", "img": "https://iux-studio.vercel.app/assets/img/work-gyeongseong.jpg", "link": ""}, {"name": "IUX SYSTEM", "cat": "기업", "img": "https://iux-studio.vercel.app/assets/img/work-iux-system.jpg", "link": ""}, {"name": "IUX Holdings", "cat": "기업", "img": "https://iux-studio.vercel.app/assets/img/work-iux-holdings.jpg", "link": ""}], "company": {"name": "IUX.STUDIO", "ceo": "", "bizNo": "", "tel": "", "email": "", "address": ""}, "popRoll": {"on": false, "sec": 5}, "popups": [{"id": "p1", "name": "연말 프로모션", "on": true, "from": "2026-10-20", "to": "2026-11-30", "pos": "center", "img": "https://iux-studio.vercel.app/assets/img/popup-promo.webp", "title": "연말 홈페이지 제작 15% 할인", "body": "11월 30일까지 상담을 신청하시면\n제작비를 15% 할인해 드립니다.", "btn": "상담 신청하기", "link": "#contact", "hideToday": true}], "pages": []}$json$::jsonb else content end,
  seo     = case when seo = '{}'::jsonb then $json${"pages": {"home": {"title": "IUX.STUDIO — 기업 홈페이지 · 브랜드 사이트 제작", "desc": "IUX.STUDIO는 기업 홈페이지, 브랜드 사이트, 쇼핑몰·랜딩페이지 제작과 리뉴얼·유지보수를 한 팀이 끝까지 책임지는 웹 스튜디오입니다.", "keywords": "홈페이지 제작, 반응형 웹, 브랜드 사이트", "og": "", "noindex": false}}, "google": "", "naver": "", "ga": "", "sitemap": true, "robots": true, "https": true}$json$::jsonb else seo end,
  ops     = case when ops = '{}'::jsonb then $json${"registrar": "", "domainExp": "", "host": "Vercel", "hostPlan": "무료", "hostExp": "", "ssl": "ok", "cost": 0, "owner": "studio", "auto": true}$json$::jsonb else ops end,
  domain  = 'iux-studio.vercel.app'
where id = 'iux-studio';
