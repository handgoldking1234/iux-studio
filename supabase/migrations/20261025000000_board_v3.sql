-- =========================================================
-- IUX Cloud v3 : 일반 게시판 (분류 · 첨부파일 · 작성자 · 방문자 글쓰기 · 댓글/대댓글)
-- Supabase > SQL Editor 에 전체를 붙여넣고 Run (한 번만)
-- =========================================================

-- ---------- 게시판 설정 ----------
alter table public.boards
  add column if not exists categories    text[]  not null default '{}',  -- 분류 목록
  add column if not exists allow_write   boolean not null default false, -- 방문자 글쓰기
  add column if not exists allow_comment boolean not null default false, -- 댓글 · 대댓글
  add column if not exists show_menu     boolean not null default false; -- 홈페이지 메뉴에 표시

-- 로봇 방지 (Cloudflare Turnstile) 사이트 키 — 공개용
alter table public.sites add column if not exists turnstile_key text;

-- ---------- 게시글 확장 ----------
alter table public.posts
  add column if not exists category      text,
  add column if not exists author_name   text,
  add column if not exists is_admin      boolean not null default true,   -- 관리자 글 / 방문자 글
  add column if not exists attachments   jsonb   not null default '[]',   -- [{name, url, size, type}]
  add column if not exists comment_count int     not null default 0,
  add column if not exists ip_hash       text;

-- 방문자 글 비밀번호 (해시만 저장, 누구도 직접 읽을 수 없음)
create table if not exists public.post_secrets (
  post_id uuid primary key references public.posts on delete cascade,
  pw_hash text not null
);
alter table public.post_secrets enable row level security;  -- 정책 없음 = 서버 함수만 접근

-- ---------- 댓글 ----------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  site_id     text not null references public.sites on delete cascade on update cascade,
  post_id     uuid not null references public.posts on delete cascade,
  parent_id   uuid references public.comments on delete cascade,      -- 대댓글이면 원댓글 id
  author_name text not null,
  body        text not null,
  is_admin    boolean not null default false,
  hidden      boolean not null default false,
  ip_hash     text,
  author      uuid references auth.users on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_post on public.comments (post_id, created_at);
create table if not exists public.comment_secrets (
  comment_id uuid primary key references public.comments on delete cascade,
  pw_hash    text not null
);
alter table public.comments enable row level security;
alter table public.comment_secrets enable row level security;

drop policy if exists cm_public on public.comments;
create policy cm_public on public.comments for select to anon, authenticated
  using ((not hidden and exists (select 1 from posts p where p.id = post_id and p.published)) or can_manage(site_id));
drop policy if exists cm_admin_insert on public.comments;
create policy cm_admin_insert on public.comments for insert to authenticated with check (can_manage(site_id) and is_admin);
drop policy if exists cm_admin_update on public.comments;
create policy cm_admin_update on public.comments for update to authenticated using (can_manage(site_id)) with check (can_manage(site_id));
drop policy if exists cm_admin_delete on public.comments;
create policy cm_admin_delete on public.comments for delete to authenticated using (can_manage(site_id));
grant select, insert, update, delete on public.comments to authenticated;
grant all on public.comments, public.comment_secrets, public.post_secrets to service_role;

-- 댓글 수 자동 집계
create or replace function public.sync_comment_count() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  update posts set comment_count = (select count(*) from comments where post_id = pid and not hidden) where id = pid;
  return null;
end $$;
drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or update of hidden or delete on public.comments for each row execute function public.sync_comment_count();

-- ---------- 방문자 글쓰기 · 댓글 (inquiry 와 같은 서버 함수 'board' 에서만 호출) ----------
create or replace function public.board_create_post(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare b boards; new_id uuid;
begin
  select * into b from boards where site_id = p->>'site' and slug = p->>'board';
  if b is null or not b.allow_write then raise exception 'write_not_allowed'; end if;
  if not exists (select 1 from sites where id = b.site_id and active) then raise exception 'unknown_site'; end if;
  if coalesce(p->>'category', '') <> '' and not (p->>'category' = any (b.categories)) then raise exception 'invalid_category'; end if;
  if length(coalesce(p->>'title', '')) < 1 or length(coalesce(p->>'name', '')) < 1 or length(coalesce(p->>'pw', '')) < 4 then raise exception 'invalid_fields'; end if;
  insert into posts (site_id, board, title, body, category, author_name, is_admin, published, ip_hash)
  values (b.site_id, b.slug, left(p->>'title', 200), left(coalesce(p->>'body', ''), 20000), nullif(p->>'category', ''), left(p->>'name', 30), false, true, p->>'ip')
  returning id into new_id;
  insert into post_secrets values (new_id, crypt(p->>'pw', gen_salt('bf')));
  return new_id;
end $$;

create or replace function public.board_check_post(pid uuid, pw text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from post_secrets s join posts p on p.id = s.post_id where s.post_id = pid and not p.is_admin and s.pw_hash = crypt(pw, s.pw_hash));
$$;

create or replace function public.board_update_post(pid uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare b boards; po posts;
begin
  select * into po from posts where id = pid and not is_admin;
  if po is null then raise exception 'not_found'; end if;
  select * into b from boards where site_id = po.site_id and slug = po.board;
  if coalesce(p->>'category', '') <> '' and not (p->>'category' = any (b.categories)) then raise exception 'invalid_category'; end if;
  update posts set title = left(coalesce(nullif(p->>'title', ''), title), 200), body = left(coalesce(p->>'body', body), 20000),
    category = nullif(p->>'category', ''), author_name = left(coalesce(nullif(p->>'name', ''), author_name), 30)
  where id = pid;
end $$;

create or replace function public.board_set_attachments(pid uuid, atts jsonb) returns void
language sql security definer set search_path = public as $$
  update posts set attachments = coalesce(atts, '[]') where id = pid and not is_admin;
$$;

create or replace function public.board_delete_post(pid uuid) returns void
language sql security definer set search_path = public as $$
  delete from posts where id = pid and not is_admin;
$$;

create or replace function public.board_create_comment(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare po posts; b boards; par comments; new_id uuid;
begin
  select * into po from posts where id = (p->>'post')::uuid and published;
  if po is null then raise exception 'not_found'; end if;
  select * into b from boards where site_id = po.site_id and slug = po.board;
  if not b.allow_comment then raise exception 'comment_not_allowed'; end if;
  if p->>'parent' is not null and p->>'parent' <> '' then
    select * into par from comments where id = (p->>'parent')::uuid and post_id = po.id and parent_id is null;
    if par is null then raise exception 'invalid_parent'; end if;
  end if;
  if length(coalesce(p->>'name', '')) < 1 or length(coalesce(p->>'body', '')) < 1 or length(coalesce(p->>'pw', '')) < 4 then raise exception 'invalid_fields'; end if;
  insert into comments (site_id, post_id, parent_id, author_name, body, ip_hash)
  values (po.site_id, po.id, par.id, left(p->>'name', 30), left(p->>'body', 3000), p->>'ip') returning id into new_id;
  insert into comment_secrets values (new_id, crypt(p->>'pw', gen_salt('bf')));
  return new_id;
end $$;

create or replace function public.board_delete_comment(cid uuid, pw text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from comment_secrets where comment_id = cid and pw_hash = crypt(pw, pw_hash)) then return false; end if;
  -- 대댓글이 달린 원댓글은 내용만 지움
  if exists (select 1 from comments where parent_id = cid) then update comments set body = '(삭제된 댓글입니다)', author_name = '-' where id = cid;
  else delete from comments where id = cid; end if;
  return true;
end $$;

-- 같은 IP 의 최근 글 · 댓글 수 (도배 방지)
create or replace function public.board_recent(ip text) returns int
language sql stable security definer set search_path = public as $$
  select (select count(*) from posts where ip_hash = ip and created_at > now() - interval '10 minutes')::int
       + (select count(*) from comments where ip_hash = ip and created_at > now() - interval '10 minutes')::int;
$$;

revoke execute on function public.board_create_post(jsonb), public.board_check_post(uuid, text), public.board_update_post(uuid, jsonb),
  public.board_set_attachments(uuid, jsonb), public.board_delete_post(uuid), public.board_create_comment(jsonb),
  public.board_delete_comment(uuid, text), public.board_recent(text) from public, anon, authenticated;
grant execute on function public.board_create_post(jsonb), public.board_check_post(uuid, text), public.board_update_post(uuid, jsonb),
  public.board_set_attachments(uuid, jsonb), public.board_delete_post(uuid), public.board_create_comment(jsonb),
  public.board_delete_comment(uuid, text), public.board_recent(text) to service_role;

-- ip_hash 는 공개하지 않음 (방문자에게는 필요한 열만 공개)
revoke select on public.posts from anon;
grant select (id, site_id, board, title, body, cover_url, pinned, published, views, created_at, updated_at,
              category, author_name, is_admin, attachments, comment_count) on public.posts to anon;
revoke select on public.comments from anon;
grant select (id, site_id, post_id, parent_id, author_name, body, is_admin, hidden, created_at) on public.comments to anon;

-- ---------- 첨부파일 저장소 ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', true, 10485760, array[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed', 'application/octet-stream', 'text/plain'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists files_insert on storage.objects;
create policy files_insert on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.can_manage((storage.foldername(name))[1]));
drop policy if exists files_delete on storage.objects;
create policy files_delete on storage.objects for delete to authenticated using (bucket_id = 'files' and public.can_manage((storage.foldername(name))[1]));

-- ---------- 홈페이지 공개 정보에 게시판 목록 · 로봇 방지 키 추가 ----------
create or replace function public.site_public(s text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', name, 'content', content, 'seo', seo - 'notes', 'turnstile', turnstile_key,
    'boards', coalesce((select jsonb_agg(jsonb_build_object('slug', b.slug, 'name', b.name, 'kind', b.kind, 'categories', b.categories,
        'allow_write', b.allow_write, 'allow_comment', b.allow_comment, 'show_menu', b.show_menu) order by b.sort, b.created_at)
      from boards b where b.site_id = sites.id), '[]'))
  from sites where id = s and active;
$$;
