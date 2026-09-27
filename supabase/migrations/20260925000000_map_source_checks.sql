create table if not exists public.map_source_checks (
  source text primary key,
  checked_at timestamptz not null,
  health text not null check (health in ('available', 'unavailable')),
  service_version text,
  max_tile_level integer,
  error text
);

alter table public.map_source_checks enable row level security;
revoke all on public.map_source_checks from anon, authenticated;
grant select on public.map_source_checks to anon, authenticated;

create policy "Public map source status is readable"
  on public.map_source_checks for select to anon, authenticated using (true);
