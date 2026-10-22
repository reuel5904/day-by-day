import type { SupabaseClient } from '@supabase/supabase-js';
import { Event, validateEvents } from './training-model';
import type { Store } from './sync-store';

export async function uploadEvents(client: SupabaseClient, userId: string, events: Event[]) {
  if (!events.length) return;
  if (!validateEvents(events))
    throw new Error('Invalid training records. Export a backup before retrying.');
  const { error } = await client
    .from('training_events')
    .upsert(
      events.map((event) => ({
        user_id: userId,
        id: event.id,
        entity: event.entity,
        parents: event.parents,
        data: event.data,
        at: event.at,
      })),
      { onConflict: 'user_id,id', ignoreDuplicates: true },
    )
    .abortSignal(AbortSignal.timeout(20000));
  if (error) throw error;
}

export async function downloadEvents(client: SupabaseClient, userId: string): Promise<Event[]> {
  const events: Event[] = [];
  let after: string | undefined;
  for (;;) {
    let query = client
      .from('training_events')
      .select('id,entity,parents,data,at')
      .eq('user_id', userId)
      .order('id')
      .limit(1000);
    if (after) query = query.gt('id', after);
    const { data, error } = await query.abortSignal(AbortSignal.timeout(20000));
    if (error) throw error;
    if (!validateEvents(data))
      throw new Error('Could not validate cloud history. Local history is safe.');
    events.push(...data);
    if (events.length > 30000) throw new Error('History is too large to sync. Export a backup.');
    if (data.length < 1000) return events;
    after = data[data.length - 1].id;
  }
}

export async function syncHistory(options: {
  client: SupabaseClient;
  userId: string;
  active: () => boolean;
  read: () => Store;
  save: (next: Store, accepted?: string[]) => void;
}) {
  const { client, userId, active, read, save } = options;
  // Supabase's RLS is the authority. This extra check avoids stale work on account switches.
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!active() || data.session?.user.id !== userId) throw new Error('Sign in again to sync.');
  const pending = [...read().pending];
  for (let offset = 0; offset < pending.length; offset += 100) {
    if (!active()) return;
    const batchIds = new Set(pending.slice(offset, offset + 100));
    const events = read().events.filter((event) => batchIds.has(event.id));
    await uploadEvents(client, userId, events);
    if (!active()) return;
    save(
      read(),
      events.map((event) => event.id),
    );
  }
  if (!active()) return;
  const remote = await downloadEvents(client, userId);
  if (active()) save({ ...read(), events: [...read().events, ...remote] });
}
