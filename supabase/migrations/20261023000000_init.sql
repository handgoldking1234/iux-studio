-- =========================================================
-- IUX Cloud : 여러 홈페이지가 함께 쓰는 문의 · 게시판 백엔드
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- 사이트 ----------
create table public.sites (
  id              text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name            text not null,
  notify_emails   text[] not null default '{}',   -- 문의 알림 받을 메일
  allowed_origins text[] not null default '{}',   -- 문의를 보낼 수 있는 도메인 (비우면 제한 없음)
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------- 권한 ----------
-- admins       : 스튜디오 운영자 (모든 사이트 관리)
-- site_members : 고객사 담당자 (자기 사이트 문의·게시판만)
create table public.admins (
  user_id    uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table public.site_members (
  user_id    uuid not null references auth.users on delete cascade,
  site_id    text not null references public.sites on delete cascade on update cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, site_id)
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function public.can_manage(s text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from site_members where user_id = auth.uid() and site_id = s);
$$;

-- ---------- 문의 ----------
create table public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  site_id    text not null references public.sites on delete cascade on update cascade,
  kind       text not null default 'quote' check (kind in ('quote', 'email', 'etc')),
  name       text not null,
  company    text,
  phone      text,
  email      text,
  subject    text,
  message    text,
  types      text[] not null default '{}',
  budget     text,
  schedule   text,
  ref_url    text,
  extra      jsonb not null default '{}',          -- 사이트별 추가 항목
  status     text not null default 'new' check (status in ('new', 'progress', 'done', 'spam')),
  memo       text,
  notified   boolean not null default false,
  origin     text,
  ip_hash    text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inquiries_site_created on public.inquiries (site_id, created_at desc);
create index inquiries_ip_created on public.inquiries (ip_hash, created_at desc);

-- ---------- 게시판 ----------
create table public.boards (
  site_id    text not null references public.sites on delete cascade on update cascade,
  slug       text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name       text not null,
  kind       text not null default 'list' check (kind in ('list', 'gallery', 'faq')),
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  primary key (site_id, slug)
);

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  site_id    text not null,
  board      text not null,
  title      text not null,
  body       text not null default '',             -- 마크다운
  cover_url  text,
  pinned     boolean not null default false,
  published  boolean not null default true,
  views      int not null default 0,
  author     uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id, board) references public.boards (site_id, slug) on delete cascade on update cascade
);
create index posts_list on public.posts (site_id, board, pinned desc, created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger inquiries_touch before update on public.inquiries for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

-- 조회수 (방문자용)
create or replace function public.increment_post_view(p uuid) returns void
language sql security definer set search_path = public as $$
  update posts set views = views + 1 where id = p and published;
$$;

-- ---------- 담당자 관리 (운영자 전용) ----------
create or replace function public.list_site_members(s text)
returns table (user_id uuid, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query select m.user_id, u.email::text, m.created_at
    from site_members m join auth.users u on u.id = m.user_id where m.site_id = s order by m.created_at;
end $$;

create or replace function public.add_site_member(s text, member_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(member_email));
  if uid is null then raise exception 'user_not_found'; end if;
  insert into site_members (user_id, site_id) values (uid, s) on conflict do nothing;
end $$;

-- 로그인한 사용자의 역할
create or replace function public.my_role() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'admin', is_admin(),
    'sites', coalesce((select jsonb_agg(site_id) from site_members where user_id = auth.uid()), '[]'::jsonb));
$$;

-- ---------- RLS ----------
alter table public.sites        enable row level security;
alter table public.admins       enable row level security;
alter table public.site_members enable row level security;
alter table public.inquiries    enable row level security;
alter table public.boards       enable row level security;
alter table public.posts        enable row level security;

create policy sites_read   on public.sites for select to authenticated using (can_manage(id));
create policy sites_write  on public.sites for all    to authenticated using (is_admin()) with check (is_admin());

create policy admins_self  on public.admins for select to authenticated using (user_id = auth.uid());

create policy members_read  on public.site_members for select to authenticated using (user_id = auth.uid() or is_admin());
create policy members_write on public.site_members for all    to authenticated using (is_admin()) with check (is_admin());

-- 문의 등록은 inquiry 함수(서비스 키)로만 가능
create policy inq_read   on public.inquiries for select to authenticated using (can_manage(site_id));
create policy inq_update on public.inquiries for update to authenticated using (can_manage(site_id)) with check (can_manage(site_id));
create policy inq_delete on public.inquiries for delete to authenticated using (can_manage(site_id));

create policy boards_public on public.boards for select to anon, authenticated using (true);
create policy boards_write  on public.boards for all    to authenticated using (can_manage(site_id)) with check (can_manage(site_id));

create policy posts_public on public.posts for select to anon, authenticated using (published or can_manage(site_id));
create policy posts_write  on public.posts for all    to authenticated using (can_manage(site_id)) with check (can_manage(site_id));

grant execute on function public.increment_post_view(uuid) to anon, authenticated;
revoke execute on function public.list_site_members(text), public.add_site_member(text, text) from public, anon;
grant execute on function public.list_site_members(text), public.add_site_member(text, text), public.my_role() to authenticated;

-- ---------- 이미지 저장소 ----------
-- 경로 규칙: media/{site_id}/파일명  (누구나 보기, 해당 사이트 관리자만 업로드)
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.can_manage((storage.foldername(name))[1]));
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.can_manage((storage.foldername(name))[1]));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.can_manage((storage.foldername(name))[1]));

-- ---------- 첫 사이트 ----------
insert into public.sites (id, name, notify_emails, allowed_origins)
values ('iux-studio', 'IUX.STUDIO', '{}', '{}') on conflict do nothing;
insert into public.boards (site_id, slug, name, kind)
values ('iux-studio', 'notice', '공지사항', 'list') on conflict do nothing;
