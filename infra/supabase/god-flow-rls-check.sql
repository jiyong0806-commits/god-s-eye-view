begin;
do $$
declare
  first_user uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  other_workflow uuid;
  affected integer;
  sample jsonb := '{"version":1,"nodes":[{"id":"input","type":"input"}],"edges":[]}';
begin
  if has_table_privilege('anon', 'public.god_workflows', 'SELECT') then
    raise exception 'Anonymous access must be denied';
  end if;
  insert into auth.users (id) values (first_user), (other_user);
  insert into public.god_workflows (owner_id, name, graph) values (other_user, 'Other owner', sample) returning id into other_workflow;
  perform set_config('request.jwt.claims', json_build_object('sub', first_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.god_workflows (name, graph) values ('Own workflow', sample);
  select count(*) into affected from public.god_workflows;
  if affected <> 1 then raise exception 'Owner isolation failed'; end if;
  update public.god_workflows set name = 'Updated' where owner_id = first_user;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner update failed'; end if;
  update public.god_workflows set name = 'Forbidden' where id = other_workflow;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign update was allowed'; end if;
  begin
    update public.god_workflows set owner_id = other_user where owner_id = first_user;
    raise exception 'Owner reassignment was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.god_workflows (owner_id, name, graph) values (other_user, 'Forbidden', sample);
    raise exception 'Foreign insert was allowed';
  exception when insufficient_privilege then null;
  end;
  delete from public.god_workflows where id = other_workflow;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foreign delete was allowed'; end if;
  delete from public.god_workflows where owner_id = first_user;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner delete failed'; end if;
  reset role;
end;
$$;
select 'PASS: anonymous denial, owner CRUD, cross-owner isolation and reassignment denial' as result;
rollback;
