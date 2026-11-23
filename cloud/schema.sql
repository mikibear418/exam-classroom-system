-- 段考監考教室系統 V1.16 — Supabase schema
-- 在 Supabase SQL Editor 執行。先建立 Auth 教師帳號，再用下方註解中的 SQL 授權班級。
-- 請勿將密碼、service_role 或 secret key 放入公開的 GitHub。
create table if not exists public.classroom_members (
  room text not null check (char_length(room) between 1 and 40),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer','editor','admin')),
  created_at timestamptz not null default now(),
  primary key(room,user_id)
);
create table if not exists public.classroom_state (
  room text primary key check (char_length(room) between 1 and 40),
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check(revision >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists classroom_members_user_idx on public.classroom_members(user_id);
alter table public.classroom_members enable row level security;
alter table public.classroom_state enable row level security;

-- 授權判斷使用 SECURITY DEFINER，避免 RLS 政策對自身遞迴查詢。
create or replace function public.classroom_can_access(p_room text,p_write boolean default false)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.classroom_members m
    where m.room = p_room
      and m.user_id = (select auth.uid())
      and (not p_write or m.role in ('editor','admin'))
  )
$$;
revoke all on function public.classroom_can_access(text,boolean) from public;
grant execute on function public.classroom_can_access(text,boolean) to authenticated;

drop policy if exists member_read_self on public.classroom_members;
create policy member_read_self on public.classroom_members
  for select to authenticated using (user_id = (select auth.uid()));
-- 班級成員只由學校管理者在 SQL Editor 或受保護的伺服器端新增，不提供網頁端任意加入功能。
drop policy if exists state_read_member on public.classroom_state;
create policy state_read_member on public.classroom_state
  for select to authenticated using (public.classroom_can_access(room,false));
drop policy if exists state_insert_editor on public.classroom_state;
create policy state_insert_editor on public.classroom_state
  for insert to authenticated
  with check (public.classroom_can_access(room,true) and updated_by = (select auth.uid()));
drop policy if exists state_update_editor on public.classroom_state;
create policy state_update_editor on public.classroom_state
  for update to authenticated
  using (public.classroom_can_access(room,true))
  with check (public.classroom_can_access(room,true) and updated_by = (select auth.uid()));
revoke all on public.classroom_members from anon;
revoke all on public.classroom_state from anon;
grant select on public.classroom_members to authenticated;
grant select, insert, update on public.classroom_state to authenticated;

-- 登入後的即時同步：只有 RLS 可讀到的資料會送達訂閱者。
do $$
begin
 if not exists(select 1 from pg_publication_tables
               where pubname='supabase_realtime' and schemaname='public' and tablename='classroom_state')
 then alter publication supabase_realtime add table public.classroom_state; end if;
end $$;

-- 操作範例（請在 Supabase SQL Editor 中依實際老師帳號修改）
-- select id,email from auth.users;
-- insert into public.classroom_members(room,user_id,role)
-- values ('知足班','實際老師 UUID'::uuid,'admin')
-- on conflict(room,user_id) do update set role=excluded.role;
-- 授權第二位老師編輯相同班級：role='editor'。
-- 只看不改：role='viewer'。
