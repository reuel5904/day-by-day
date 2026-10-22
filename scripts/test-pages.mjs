import assert from 'node:assert/strict';
import { build } from 'esbuild';
await build({
  entryPoints: ['web/src/training-model.ts', 'web/src/exercises.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: '.work/pages-test',
  outExtension: { '.js': '.mjs' },
});
const {
  days,
  heads,
  latest,
  streaks,
  onTime,
  deadline,
  effectiveDate,
  moveWorkout,
  mergeEvents,
  validateEvents,
  resultEntries,
  completionChanges,
  completionKey,
  isSetComplete,
} = await import('../.work/pages-test/training-model.mjs');
const { EXERCISES } = await import('../.work/pages-test/exercises.mjs');
let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log('✓ ' + name);
}
const event = (id, entity, data, parents = []) => ({
  id,
  entity,
  data,
  parents,
  at: '2026-10-19T12:00:00.000Z',
});
const sectionWith = (text) => days.flatMap((d) => d.sections).find((s) => s.text.startsWith(text));
// What the original text parser produced for every workout up to Oct 22, as
// "sectionExerciseId:sets:unit". Saved results are keyed by these IDs, so they must not change.
const beforeConversion = {
  '2026-10-13':
    'b0e0:1:check b1e0:1:run b2e0:3:sec b3e0:2:sec b4e0:3:reps b5e0:3:reps b6e0:1:check',
  '2026-10-14':
    'b0e0:1:check b1e0:4:reps b2e0:3:reps b2e1:3:reps b3e0:3:reps b4e0:3:reps b4e1:3:reps',
  '2026-10-15':
    'b0e0:1:check b1e0:1:run b2e0:3:sec b3e0:2:sec b4e0:3:reps b5e0:3:reps b6e0:1:check',
  '2026-10-16':
    'b0e0:1:check b1e0:4:reps b2e0:3:reps b2e1:3:reps b3e0:3:reps b4e0:3:reps b4e1:3:reps b5e0:1:sec',
  '2026-10-17': 'b0e0:1:run b1e0:1:check',
  '2026-10-18': '',
  '2026-10-19':
    'b0e0:1:check b1e0:4:reps b2e0:3:reps b2e1:3:reps b3e0:3:reps b4e0:3:reps b4e1:3:reps',
  '2026-10-20':
    'b0e0:1:check b1e0:1:run b2e0:3:sec b3e0:3:sec b4e0:2:sec b5e0:3:reps b6e0:3:reps b7e0:1:check',
  '2026-10-21':
    'b0e0:1:check b1e0:4:reps b2e0:3:reps b2e1:3:reps b3e0:3:reps b4e0:3:reps b4e1:3:reps',
  '2026-10-22':
    'b0e0:1:check b1e0:1:run b2e0:3:sec b3e0:3:sec b4e0:2:sec b5e0:3:reps b6e0:3:reps b7e0:1:check',
};
test('Workouts up to Oct 22 keep the IDs, set counts and units their history uses', () => {
  for (const [date, expected] of Object.entries(beforeConversion)) {
    const d = days.find((d) => d.date === date);
    const actual = d.sections
      .flatMap((s) => s.exercises.map((e) => `${e.id}:${e.count}:${e.unit}`))
      .join(' ');
    assert.equal(actual, expected, date);
  }
});
test('The program keeps all 90 dated days with their written prescriptions', () => {
  assert.equal(days.length, 90);
  assert.equal(days[0].date, '2026-10-13');
  assert.equal(days.at(-1).date, '2027-01-10');
  assert.equal(new Set(days.map((d) => d.date)).size, 90);
  for (const d of days) for (const s of d.sections) assert.ok(s.text && s.exercises.length, d.date);
});
test('Every exercise is on the shared exercise list', () => {
  for (const d of days)
    for (const s of d.sections)
      for (const e of s.exercises) assert.ok(EXERCISES.includes(e.name), `${d.date} ${e.name}`);
});
test('Keep the unmatched extra push-up set', () => {
  const s = days.find((d) => d.date === '2026-10-26').sections[2];
  assert.equal(s.exercises[0].count, 4);
  assert.equal(s.exercises[1].count, 3);
});
test('Keep negative tempo separate from rep count', () => {
  const [e] = sectionWith('C. Negative Pull-Ups: 3×2 @ 4s').exercises;
  assert.equal(e.count, 3);
  assert.equal(e.unit, 'reps');
  assert.equal(e.target, '2');
  assert.equal(e.tempo, '4s');
});
test('Split a max pull-up test from two easy back-off sets', () => {
  const s = sectionWith('TEST: Pull-Ups, 1 max set.');
  assert.equal(s.exercises.length, 2);
  assert.equal(s.exercises[0].count, 1);
  assert.equal(s.exercises[1].count, 2);
  assert.equal(s.exercises[1].target, '3');
});
test('Final dead hang test is one hold, not three guessed sets', () => {
  const [e] = sectionWith('TEST: Max Dead Hang.').exercises;
  assert.equal(e.count, 1);
  assert.equal(e.name, 'Dead Hang');
  assert.equal(e.unit, 'sec');
});
test('Do not confuse strides with distance or a two-leg variation with unilateral work', () => {
  const run = sectionWith('Run: 3 mi easy, then Strides 4×15s');
  assert.equal(run.exercises[0].unit, 'run');
  assert.equal(run.exercises[1].unit, 'sec');
  assert.equal(run.exercises[1].count, 4);
  const bridge = sectionWith(
    'D. Superset ×3: Pike chain 6-12 [Floor Pike] → Glute Bridge chain [two-leg',
  );
  assert.equal(bridge.exercises[1].sides, false);
});
test('Every pull-up and chin-up day that offers 4×6-8 lets you choose it', () => {
  const offers = days.flatMap((d) => d.sections).filter((s) => s.text.includes('4×6-8'));
  assert.equal(offers.length, 15);
  for (const s of offers)
    assert.deepEqual(
      s.alternatives.map((a) => a.count),
      [5, 4],
    );
});
test('Test week drops non-test core work to 2 sets', () => {
  for (const date of ['2027-01-05', '2027-01-07']) {
    const exercises = days.find((d) => d.date === date).sections.flatMap((s) => s.exercises);
    for (const name of ['Dead Bug', 'Calf Raises'])
      assert.equal(exercises.find((e) => e.name === name).count, 2, `${date} ${name}`);
  }
});
test('Progression suggestions apply only to W1-W7 rep ranges, never to pull-ups or chin-ups', () => {
  for (const d of days)
    for (const s of d.sections)
      for (const e of s.exercises.filter((e) => e.progression)) {
        assert.match(d.code, /^W[1-7]$/);
        assert.notEqual(e.top, null);
        assert.doesNotMatch(e.name, /Pull-Ups|Chin-Ups/);
      }
});
test('Concurrent offline edits remain conflicts until explicitly resolved', () => {
  const root = event('a', 'notes:2026-10-19', { text: 'old' });
  const left = event('b', root.entity, { text: 'left' }, ['a']);
  const right = event('c', root.entity, { text: 'right' }, ['a']);
  const all = mergeEvents([root, left], [root, right]);
  assert.equal(all.length, 3);
  const map = heads(all);
  assert.equal(map[root.entity].length, 2);
  assert.equal(latest(map, root.entity), undefined);
  const resolved = event('d', root.entity, { text: 'selected' }, ['b', 'c']);
  assert.equal(latest(heads([...all, resolved]), root.entity).text, 'selected');
});
test('Scheduled rest preserves a streak without a check-in; today is not prematurely missed', () => {
  const events = ['2026-10-16', '2026-10-17'].map((d, i) =>
    event('e' + i, 'session:' + d, { status: 'complete', actualDate: d }),
  );
  assert.deepEqual(streaks(heads(events), '2026-10-19'), { current: 2, best: 2 });
  assert.equal(streaks(heads(events), '2026-10-20').current, 0);
});
test('Partial and late workouts are activity, not on-time completion', () => {
  const d = days.find((d) => d.date === '2026-10-19');
  assert.equal(
    onTime(d, heads([event('p', 'session:' + d.date, { status: 'partial', actualDate: d.date })])),
    false,
  );
  assert.equal(
    onTime(
      d,
      heads([event('l', 'session:' + d.date, { status: 'complete', actualDate: '2026-10-20' })]),
    ),
    false,
  );
});
test('Moving an already-missed workout does not erase its original deadline', () => {
  const d = days.find((d) => d.date === '2026-10-19');
  const events = [
    event('m', 'schedule:' + d.date, { due: '2026-10-21', originalDate: d.date, lateMove: true }),
    event('s', 'session:' + d.date, { status: 'complete', actualDate: '2026-10-21' }),
  ];
  assert.equal(onTime(d, heads(events)), false);
});
test('Moving a workout again before its scheduled date passes keeps it on time', () => {
  const d = days.find((d) => d.date === '2026-10-21');
  const first = event(
    'move1',
    'schedule:' + d.date,
    moveWorkout(d, heads([]), '2026-10-20', '2026-10-23'),
  );
  const second = event(
    'move2',
    'schedule:' + d.date,
    moveWorkout(d, heads([first]), '2026-10-22', '2026-10-24'),
    [first.id],
  );
  const done = event('done', 'session:' + d.date, { status: 'complete', actualDate: '2026-10-24' });
  assert.equal(second.data.lateMove, false);
  assert.equal(deadline(d, heads([first, second])), '2026-10-24');
  assert.equal(onTime(d, heads([first, second, done])), true);
});
test('A workout missed twice keeps the first scheduled date it missed as its deadline', () => {
  const d = days.find((d) => d.date === '2026-10-21');
  const moves = [];
  for (const [today, due] of [
    ['2026-10-20', '2026-10-23'],
    ['2026-10-25', '2026-10-27'],
    ['2026-10-28', '2026-10-30'],
  ]) {
    const parents = moves.length ? [moves.at(-1).id] : [];
    const data = moveWorkout(d, heads(moves), today, due);
    moves.push(event('move' + moves.length, 'schedule:' + d.date, data, parents));
  }
  assert.equal(validateEvents(moves), true);
  assert.equal(effectiveDate(d, heads(moves)), '2026-10-30');
  assert.equal(deadline(d, heads(moves)), '2026-10-23');
});
test('Imported completion never creates measured performance or an assumed training date', () => {
  const events = [
    event('v1', 'session:2026-10-16', { status: 'legacy-complete', actualDate: null }),
  ];
  assert.equal(validateEvents(events), true);
  assert.equal(resultEntries(heads(events)).length, 0);
  assert.equal(streaks(heads(events), '2026-10-19').current, 0);
});
test('Reject malformed imported results and unsafe entity names', () => {
  assert.equal(validateEvents([event('bad', '__proto__', { text: 'bad' })]), false);
  assert.equal(
    validateEvents([event('bad', 'set:2026-10-19:b1e0:0', { value: { bad: 'shape' } })]),
    false,
  );
  assert.equal(validateEvents([event('bad', 'notes:2026-10-19', { text: 23 })]), false);
});
test('Check all records completion without inventing reps or times', () => {
  const keys = ['set:2026-10-19:b1e0:0', 'set:2026-10-19:b1e0:1'];
  const changes = completionChanges({}, keys, '2026-10-19', '2026-10-19');
  const events = changes.map((c, i) => event('complete' + i, c.entity, c.data));
  assert.equal(validateEvents(events), true);
  const map = heads(events);
  assert.ok(keys.every((k) => isSetComplete(map, k)));
  assert.deepEqual(resultEntries(map), []);
  assert.ok(changes.every((c) => !('value' in c.data)));
});
test('Bulk completion only changes the requested incomplete sets', () => {
  const numeric = event('numeric', 'set:2026-10-19:b1e0:0', {
    value: 3,
    unit: 'reps',
    name: 'Pull-Ups',
    variation: 'Standard',
    assistance: '',
    sides: false,
    day: '2026-10-19',
    actualDate: '2026-10-19',
  });
  const map = heads([numeric]);
  const changes = completionChanges(
    map,
    [numeric.entity, 'set:2026-10-19:b1e0:1'],
    '2026-10-19',
    '2026-10-19',
  );
  assert.equal(changes.length, 1);
  assert.equal(changes[0].entity, 'completion:2026-10-19:b1e0:1');
  assert.equal(latest(map, numeric.entity).value, 3);
});
test('Unchecking a completion preserves recorded performance', () => {
  const key = 'set:2026-10-19:b1e0:0';
  const numeric = event('number', key, {
    value: 3,
    unit: 'reps',
    name: 'Pull-Ups',
    variation: 'Standard',
    assistance: '',
    sides: false,
    day: '2026-10-19',
    actualDate: '2026-10-19',
  });
  const unchecked = event('uncheck', completionKey(key), {
    completed: false,
    day: '2026-10-19',
    actualDate: '2026-10-19',
  });
  const map = heads([numeric, unchecked]);
  assert.equal(isSetComplete(map, key), false);
  assert.equal(resultEntries(map)[0].value, 3);
});
test('Bulk completion cannot silently resolve a conflicting measurement', () => {
  const key = 'set:2026-10-19:b1e0:0';
  const map = heads([event('left', key, { value: 2 }), event('right', key, { value: 3 })]);
  assert.equal(completionChanges(map, [key], '2026-10-19', '2026-10-19').length, 0);
  assert.equal(isSetComplete(map, key), false);
});
test('Undoing a bulk check restores the prior explicit incomplete state', () => {
  const key = 'set:2026-10-19:b1e0:0';
  const before = event('before', completionKey(key), {
    completed: false,
    day: '2026-10-19',
    actualDate: '2026-10-19',
  });
  const checked = event('checked', before.entity, { ...before.data, completed: true }, [before.id]);
  const undone = event('undone', before.entity, before.data, [checked.id]);
  assert.equal(isSetComplete(heads([before, checked]), key), true);
  assert.equal(isSetComplete(heads([before, checked, undone]), key), false);
});
test('A history with imported completions still validates', () => {
  const events = [
    event('legacy-v1-legacy-2026-10-16', 'legacy:2026-10-16', {
      checks: [true, true],
      complete: true,
      originalNotes: '',
    }),
    event('legacy-v1-session-2026-10-16', 'session:2026-10-16', {
      status: 'legacy-complete',
      actualDate: null,
      source: 'v1',
    }),
  ];
  assert.equal(validateEvents(events), true);
});
console.log(`\n${count} domain and data-integrity checks passed.`);
