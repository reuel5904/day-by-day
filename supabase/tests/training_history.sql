begin;
insert into auth.users(id) values
('00000000-0000-4000-8000-000000000001'),
('00000000-0000-4000-8000-000000000002');
insert into public.training_events(user_id,id,entity,parents,data,at) values
('00000000-0000-4000-8000-000000000001','owner-record','notes:2026-10-19','[]','{"text":"test owner"}','2026-10-19T12:00:00.000Z'),
('00000000-0000-4000-8000-000000000002','other-record','notes:2026-10-19','[]','{"text":"test other"}','2026-10-19T12:00:00.000Z');
set local role anon;
do $$ begin
  begin
    perform * from public.training_events;
    raise exception 'Anonymous history read should fail';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.training_events(id,entity,at) values ('anon','notes:2026-10-19','2026-10-19T12:00:00.000Z');
    raise exception 'Anonymous history write should fail';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.training_events) <> 1 then raise exception 'Cross-user history leaked'; end if;
  insert into public.training_events(id,entity,data,at) values ('new-record','notes:2026-10-19','{"text":"test"}','2026-10-19T12:00:00.000Z');
  insert into public.training_events(id,entity,data,at) values ('new-record','notes:2026-10-19','{"text":"retry"}','2026-10-19T12:00:00.000Z')
    on conflict (user_id,id) do nothing;
  if (select data->>'text' from public.training_events where id='new-record') <> 'test' then raise exception 'Retry modified immutable history'; end if;
  begin
    insert into public.training_events(user_id,id,entity,data,at) values ('00000000-0000-4000-8000-000000000002','forged','notes:2026-10-19','{}','2026-10-19T12:00:00.000Z');
    raise exception 'Cross-user insert should fail';
  exception when insufficient_privilege then null; end;
  begin
    update public.training_events set data='{}' where id='new-record';
    raise exception 'Immutable record update should fail';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.training_events where id='new-record';
    raise exception 'Immutable record delete should fail';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Passed: anonymous denied; owner read/append allowed; other user hidden; cross-user writes denied; retries idempotent; updates/deletes denied; all synthetic data rolled back' as result;
