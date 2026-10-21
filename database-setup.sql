begin;
create table if not exists public.cinelanka_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.cinelanka_catalog (
 id integer primary key check(id=1),
 movies jsonb not null default '[]'::jsonb check(jsonb_typeof(movies)='array' and jsonb_array_length(movies)<=1000),
 version integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.cinelanka_admins enable row level security;
alter table public.cinelanka_catalog enable row level security;
revoke all on public.cinelanka_admins from anon,authenticated;
revoke all on public.cinelanka_catalog from anon,authenticated;
grant select on public.cinelanka_admins to authenticated;
grant select on public.cinelanka_catalog to anon,authenticated;
grant update on public.cinelanka_catalog to authenticated;
drop policy if exists "Admins can read own membership" on public.cinelanka_admins;
create policy "Admins can read own membership" on public.cinelanka_admins for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Anyone can view movies" on public.cinelanka_catalog;
create policy "Anyone can view movies" on public.cinelanka_catalog for select to anon,authenticated using(true);
drop policy if exists "Only listed admins can edit movies" on public.cinelanka_catalog;
create policy "Only listed admins can edit movies" on public.cinelanka_catalog for update to authenticated
using(exists(select 1 from public.cinelanka_admins where user_id=(select auth.uid())))
with check(exists(select 1 from public.cinelanka_admins where user_id=(select auth.uid())));
insert into public.cinelanka_catalog(id) values(1) on conflict(id) do nothing;
create or replace function public.cinelanka_save_catalog(p_movies jsonb,p_expected_version integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare next_version integer;
begin
 if not exists(select 1 from public.cinelanka_admins where user_id=auth.uid()) then raise exception 'admin_required'; end if;
 if jsonb_typeof(p_movies)!='array' or jsonb_array_length(p_movies)>1000 then raise exception 'invalid_catalog'; end if;
 update public.cinelanka_catalog set movies=p_movies,version=version+1,updated_at=now() where id=1 and version=p_expected_version returning version into next_version;
 if next_version is null then raise exception 'catalog_conflict'; end if;
 return next_version;
end $$;
revoke all on function public.cinelanka_save_catalog(jsonb,integer) from public,anon;
grant execute on function public.cinelanka_save_catalog(jsonb,integer) to authenticated;
commit;
-- After creating the owner's login in Authentication > Users, grant admin:
-- insert into public.cinelanka_admins(user_id)
-- select id from auth.users where email = 'OWNER_EMAIL';

