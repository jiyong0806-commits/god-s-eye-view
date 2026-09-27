create table if not exists public.plasma_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  occupation text not null default '' check (length(occupation) <= 80),
  hobbies text not null default '' check (length(hobbies) <= 160),
  income_source text not null default '' check (length(income_source) <= 80),
  region text not null default '' check (length(region) <= 100),
  age_band text not null default '' check (age_band in ('', '14-19', '20-29', '30-49', '50+')),
  interests jsonb not null default '[]' check (jsonb_typeof(interests) = 'array' and jsonb_array_length(interests) <= 12),
  personalization_consent boolean not null default false,
  updated_at timestamptz not null default now()
);
create table if not exists public.plasma_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  altitude double precision not null check (altitude between 20 and 50000000),
  created_at timestamptz not null default now()
);
alter table public.plasma_profiles enable row level security;
alter table public.plasma_bookmarks enable row level security;
revoke all on public.plasma_profiles, public.plasma_bookmarks from anon;
grant select, insert, update, delete on public.plasma_profiles, public.plasma_bookmarks to authenticated;
create policy "profiles_owner_only" on public.plasma_profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "bookmarks_owner_only" on public.plasma_bookmarks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists plasma_bookmarks_owner on public.plasma_bookmarks(user_id, created_at desc);
