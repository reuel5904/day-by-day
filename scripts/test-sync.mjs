import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';

await build({
  entryPoints: ['web/src/sync-store.ts', 'web/src/cloud-sync.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: '.work/sync-tests',
});
const { storageKey, readStore, combineStores, addHistory } =
  await import('../.work/sync-tests/sync-store.js');
const { syncHistory, downloadEvents } = await import('../.work/sync-tests/cloud-sync.js');
const event = (id, text = id) => ({
  id,
  entity: 'notes:2026-10-19',
  parents: [],
  data: { text },
  at: '2026-10-19T12:00:00.000Z',
});
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log('✓ ' + name);
}
function clientWith(fetch, userId = 'owner') {
  const client = createClient('https://example.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
  client.auth.getSession = async () => ({
    data: { session: { access_token: 'test-session', user: { id: userId } } },
    error: null,
  });
  return client;
}
const storage = (initial) => ({ getItem: (key) => initial[key] ?? null });

await test('Guest and account caches stay separate, and invalid pending IDs cannot stall sync', () => {
  const local = { events: [event('local')], pending: ['local', 'missing', {}, 'local'] };
  const data = storage({ [storageKey()]: JSON.stringify(local) });
  assert.deepEqual(readStore(data, storageKey()).pending, ['local']);
  assert.deepEqual(readStore(data, storageKey('other-account')), { events: [], pending: [] });
});
await test('Adding browser history preserves both histories and retries only new IDs', () => {
  const local = [event('local')];
  const account = { events: [event('remote')], pending: [] };
  const next = addHistory(account, local);
  assert.equal(next.events.length, 2);
  assert.deepEqual(next.pending, ['local']);
  assert.deepEqual(addHistory(next, local), next);
  assert.equal(local.length, 1);
});
await test('Acknowledging an upload preserves a second tab’s newer edits', () => {
  const before = { events: [event('a')], pending: ['a'] };
  const disk = { events: [event('a'), event('b')], pending: ['a', 'b'] };
  const next = combineStores(disk, before, ['a']);
  assert.deepEqual(next.pending, ['b']);
  assert.equal(next.events.length, 2);
});
await test('Upload retries use immutable IDs and keep edits made while the request is in flight', async () => {
  let store = {
    events: [{ ...event('a'), user_id: 'forged-owner', extra: 'not-a-column' }],
    pending: ['a'],
  };
  let uploads = 0;
  const client = clientWith(async (url, init) => {
    const target = new URL(url);
    if (init.method === 'POST') {
      uploads++;
      assert.equal(target.searchParams.get('on_conflict'), 'user_id,id');
      assert.match(new Headers(init.headers).get('prefer'), /resolution=ignore-duplicates/);
      assert.equal(JSON.parse(init.body)[0].user_id, 'owner');
      assert.equal(JSON.parse(init.body)[0].extra, undefined);
      store = addHistory(store, [event('new-edit')]);
      return response(null, 201);
    }
    assert.equal(target.searchParams.get('user_id'), 'eq.owner');
    return response([event('remote')]);
  });
  await syncHistory({
    client,
    userId: 'owner',
    active: () => true,
    read: () => store,
    save: (next, ids) => {
      store = combineStores(store, next, ids);
    },
  });
  assert.equal(uploads, 1);
  assert.deepEqual(store.pending, ['new-edit']);
  assert.equal(store.events.length, 3);
});
await test('Rejected uploads keep all pending records for a later retry', async () => {
  const store = { events: [event('a')], pending: ['a'] };
  let saves = 0;
  const client = clientWith(async () => response({ message: 'denied', code: '42501' }, 403));
  await assert.rejects(
    syncHistory({
      client,
      userId: 'owner',
      active: () => true,
      read: () => store,
      save: () => saves++,
    }),
  );
  assert.equal(saves, 0);
  assert.deepEqual(store.pending, ['a']);
});
await test('An account switch blocks stale uploads before they reach the network', async () => {
  let requests = 0;
  const client = clientWith(async () => {
    requests++;
    return response([]);
  }, 'different-owner');
  await assert.rejects(
    syncHistory({
      client,
      userId: 'owner',
      active: () => true,
      read: () => ({ events: [], pending: [] }),
      save: () => assert.fail('stale save'),
    }),
    /Sign in again/,
  );
  assert.equal(requests, 0);
});
await test('Signing out during an upload prevents stale data from reaching the next account', async () => {
  let active = true;
  let saves = 0;
  let requests = 0;
  const client = clientWith(async () => {
    requests++;
    active = false;
    return response(null, 201);
  });
  await syncHistory({
    client,
    userId: 'owner',
    active: () => active,
    read: () => ({ events: [event('a')], pending: ['a'] }),
    save: () => saves++,
  });
  assert.equal(requests, 1);
  assert.equal(saves, 0);
});
await test('Downloads read past the 1,000-row API limit without losing history', async () => {
  let requests = 0;
  const rows = Array.from({ length: 1000 }, (_, i) => event(`event-${String(i).padStart(4, '0')}`));
  const client = clientWith(async (url) => {
    requests++;
    const query = new URL(url).searchParams;
    assert.equal(query.get('user_id'), 'eq.owner');
    if (requests === 1) return response(rows);
    assert.equal(query.get('id'), 'gt.event-0999');
    return response([event('last-event')]);
  });
  assert.equal((await downloadEvents(client, 'owner')).length, 1001);
  assert.equal(requests, 2);
});
await test('Malformed remote history never replaces a valid local cache', async () => {
  const store = { events: [event('local')], pending: [] };
  const client = clientWith(async () => response([{ id: 'bad' }]));
  await assert.rejects(
    syncHistory({
      client,
      userId: 'owner',
      active: () => true,
      read: () => store,
      save: () => assert.fail('invalid remote save'),
    }),
    /validate cloud history/,
  );
  assert.equal(store.events[0].id, 'local');
});
console.log(`\n${count} sync integrity checks passed.`);
