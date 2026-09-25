create table public.god_workflows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  graph jsonb not null check (
    jsonb_typeof(graph) = 'object'
    and graph ?& array['version', 'nodes', 'edges']
    and graph @> '{"version":1}'::jsonb
    and jsonb_typeof(graph -> 'nodes') = 'array'
    and jsonb_typeof(graph -> 'edges') = 'array'
    and jsonb_array_length(graph -> 'nodes') between 1 and 64
    and jsonb_array_length(graph -> 'edges') <= 192
    and octet_length(graph::text) <= 262144
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index god_workflows_owner_updated_idx on public.god_workflows (owner_id, updated_at desc);
alter table public.god_workflows enable row level security;
revoke all on public.god_workflows from public, anon, authenticated;
grant select, insert, update, delete on public.god_workflows to authenticated;
create policy workflows_select_own on public.god_workflows for select to authenticated using ((select auth.uid()) = owner_id);
create policy workflows_insert_own on public.god_workflows for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy workflows_update_own on public.god_workflows for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy workflows_delete_own on public.god_workflows for delete to authenticated using ((select auth.uid()) = owner_id);

create function public.touch_god_workflow() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end;
$$;
revoke all on function public.touch_god_workflow() from public, anon, authenticated;
create trigger god_workflows_updated before update on public.god_workflows
  for each row execute function public.touch_god_workflow();
