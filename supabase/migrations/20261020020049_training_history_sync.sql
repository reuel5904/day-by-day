create table public.training_events (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,100}$'),
  entity text not null check (length(entity) < 250 and entity ~ '^(set|completion|session|config|stage|notes|schedule|legacy):'),
  parents jsonb not null default '[]'::jsonb check (jsonb_typeof(parents) = 'array' and jsonb_array_length(parents) <= 100),
  data jsonb check (data is null or jsonb_typeof(data) in ('object', 'null')),
  at text not null check (length(at) between 10 and 64),
  received_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint training_event_size check (octet_length(coalesce(data::text, 'null')) < 60000)
);

alter table public.training_events enable row level security;

-- History is append-only: corrections and removals are new resolving events.
-- The composite primary key makes retries idempotent and supports user-scoped reads.
revoke all on public.training_events from public, anon, authenticated;
grant select, insert on public.training_events to authenticated;

create policy "Read own training history"
on public.training_events for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Append own training history"
on public.training_events for insert to authenticated
with check ((select auth.uid()) = user_id);

comment on table public.training_events is 'Private, append-only workout events. Browser retries ignore duplicate (user_id,id) records.';
