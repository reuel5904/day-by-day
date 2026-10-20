import { Event, mergeEvents, validateEvents } from './training-model';

export type Store = { events: Event[]; pending: string[] };
export const storageKey = (userId?: string) => `day-by-day-v2:${userId || 'local'}`;
export const emptyStore = (): Store => ({ events: [], pending: [] });

export function readStore(storage: Pick<Storage, 'getItem'>, key: string): Store {
  const raw = storage.getItem(key);
  if (!raw) return emptyStore();
  const parsed = JSON.parse(raw);
  if (!parsed || !validateEvents(parsed.events) || !Array.isArray(parsed.pending)) {
    throw new Error('Could not read saved history. Restore a JSON backup in Settings.');
  }
  const ids = new Set(parsed.events.map((event: Event) => event.id));
  return { events: parsed.events, pending: [...new Set<string>(parsed.pending.filter((id: unknown) => typeof id === 'string' && ids.has(id)))] };
}

// Merge with the latest on-disk state so another tab's edits survive a sync response.
// Only acknowledged IDs are removed; changes made during an upload remain queued.
export function combineStores(left: Store, right: Store, accepted: string[] = []): Store {
  const events = mergeEvents(left.events, right.events);
  const ids = new Set(events.map(event => event.id));
  const acknowledged = new Set(accepted);
  return {
    events,
    pending: [...new Set([...left.pending, ...right.pending])].filter(id => ids.has(id) && !acknowledged.has(id)),
  };
}

export function addHistory(store: Store, incoming: Event[]): Store {
  const ids = new Set(store.events.map(event => event.id));
  const added = incoming.filter(event => !ids.has(event.id));
  return combineStores(store, { events: added, pending: added.map(event => event.id) });
}
