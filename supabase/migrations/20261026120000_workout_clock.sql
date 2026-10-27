-- Workout clock events (ADR-0008) join the entity types history accepts.
alter table public.training_events drop constraint training_events_entity_check;
alter table public.training_events add constraint training_events_entity_check
  check (length(entity) < 250 and entity ~ '^(set|completion|session|config|stage|notes|schedule|legacy|clock):');
