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
  calendar,
  programsIn,
  canUndoRepeat,
  earliestRepeat,
  lastLoggedDate,
  previewRepeat,
  repeatChanges,
  repeatKey,
  validEventData,
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
  currentVariation,
  isSetComplete,
  setKey,
  untickChanges,
  workoutStatus,
  prescriptionLine,
  finishedProgramAt,
  screenFromHash,
  hashForScreen,
  clockOf,
  clockSeconds,
  clockStops,
  startClock,
  pauseClock,
  workoutDuration,
  formatClock,
  formatDuration,
} = await import('../.work/pages-test/training-model.mjs');
const { EXERCISES } = await import('../.work/pages-test/exercises.mjs');
const days = calendar({});
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
const requiredSets = (date) =>
  days
    .find((d) => d.date === date)
    .sections.filter((s) => s.kind !== 'prep')
    .flatMap((s) =>
      s.exercises.flatMap((e) => Array.from({ length: e.count }, (_, i) => `${e.id}:${i}`)),
    );
const tick = (date, sets, actualDate = date) =>
  sets.map((set) =>
    event(`tick-${date}-${set}`, `completion:${date}:${set}`, {
      completed: true,
      day: date,
      actualDate,
    }),
  );
const exerciseOf = (date, id) =>
  days
    .find((d) => d.date === date)
    .sections.flatMap((s) => s.exercises)
    .find((e) => e.id === id);
let changeId = 0;
const changeEvents = (changes, map = {}) =>
  changes.map((c) =>
    event(
      'change' + changeId++,
      c.entity,
      c.data,
      (map[c.entity] || []).map((e) => e.id),
    ),
  );
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
test('A workout is complete once every exercise set is ticked; warm-ups are optional', () => {
  const d = days.find((d) => d.date === '2026-10-19');
  const status = workoutStatus(d, heads(tick(d.date, requiredSets(d.date))), '2026-10-19');
  assert.equal(status.id, 'complete');
  assert.equal(status.actualDate, '2026-10-19');
});
test('A started workout becomes partial once its scheduled date passes', () => {
  const d = days.find((d) => d.date === '2026-10-19');
  const map = heads(tick(d.date, requiredSets(d.date).slice(0, 3)));
  assert.equal(workoutStatus(d, map, '2026-10-19').id, 'started');
  assert.equal(workoutStatus(d, map, '2026-10-20').id, 'partial');
  assert.equal(workoutStatus(d, {}, '2026-10-20').id, 'empty');
});
test('A workout finished on a later day is complete but not on time', () => {
  const d = days.find((d) => d.date === '2026-10-19');
  const [first, ...rest] = requiredSets(d.date);
  const map = heads([...tick(d.date, [first]), ...tick(d.date, rest, '2026-10-20')]);
  assert.equal(workoutStatus(d, map, '2026-10-21').actualDate, '2026-10-20');
  assert.equal(onTime(d, map), false);
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
  const events = ['2026-10-16', '2026-10-17'].flatMap((d) => tick(d, requiredSets(d)));
  assert.deepEqual(streaks(heads(events), '2026-10-19'), { current: 2, best: 2 });
  assert.equal(streaks(heads(events), '2026-10-20').current, 0);
});
test('Partial and late workouts are activity, not on-time completion', () => {
  const d = days.find((d) => d.date === '2026-10-19');
  const partial = event('p', 'session:' + d.date, { status: 'partial', actualDate: d.date });
  assert.equal(onTime(d, heads([...tick(d.date, requiredSets(d.date).slice(1)), partial])), false);
  assert.equal(onTime(d, heads(tick(d.date, requiredSets(d.date), '2026-10-20'))), false);
});
test('Moving an already-missed workout does not erase its original deadline', () => {
  const d = days.find((d) => d.date === '2026-10-19');
  const events = [
    event('m', 'schedule:' + d.date, { due: '2026-10-21', originalDate: d.date, lateMove: true }),
    ...tick(d.date, requiredSets(d.date), '2026-10-21'),
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
  const done = tick(d.date, requiredSets(d.date), '2026-10-24');
  assert.equal(second.data.lateMove, false);
  assert.equal(deadline(d, heads([first, second])), '2026-10-24');
  assert.equal(onTime(d, heads([first, second, ...done])), true);
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
test('Ticking a fixed-target set records that target as its result', () => {
  const hold = exerciseOf('2026-10-13', 'b2e0');
  const key = setKey('2026-10-13', hold, 0);
  const events = changeEvents(
    completionChanges({}, [{ key, exercise: hold }], '2026-10-13', '2026-10-13'),
  );
  assert.equal(validateEvents(events), true);
  const map = heads(events);
  assert.equal(isSetComplete(map, key), true);
  const [result] = resultEntries(map);
  assert.equal(result.value, 20);
  assert.equal(result.unit, 'sec');
  assert.equal(result.variation, 'tucked');
  assert.equal(result.asPrescribed, true);
});
const advancedTo = (name, variation) =>
  heads([event('advance-' + name, `stage:${name}`, { variation, previous: '' })]);
test('An exercise without a progression rule shows its written variation, whatever was stored', () => {
  const hold = exerciseOf('2026-10-13', 'b2e0');
  assert.equal(currentVariation(advancedTo('Hollow Hold', 'one-leg'), hold), 'tucked');
});
test('Ticking a fixed-target set records the written variation, whatever was stored', () => {
  const hold = exerciseOf('2026-10-13', 'b2e0');
  const key = setKey('2026-10-13', hold, 0);
  const stored = advancedTo('Hollow Hold', 'one-leg');
  const events = changeEvents(
    completionChanges(stored, [{ key, exercise: hold }], '2026-10-13', '2026-10-13'),
  );
  assert.equal(resultEntries(heads(events))[0].variation, 'tucked');
});
test('An exercise with a progression rule shows and records its stored current variation', () => {
  const pushUps = exerciseOf('2026-11-02', 'b2e0');
  assert.equal(currentVariation({}, pushUps), 'Standard');
  const stored = advancedTo('Push-Ups', 'Decline');
  assert.equal(currentVariation(stored, pushUps), 'Decline');
  // A ticked fixed target records it too. No written exercise pairs a rule with a fixed target.
  const fixed = { ...pushUps, target: '12' };
  const key = setKey('2026-11-02', fixed, 0);
  const events = changeEvents(
    completionChanges(stored, [{ key, exercise: fixed }], '2026-11-02', '2026-11-02'),
  );
  assert.equal(resultEntries(heads(events))[0].variation, 'Decline');
});
test('Ticking a range or a max test records completion without a number', () => {
  for (const [date, id] of [
    ['2026-11-02', 'b2e0'],
    ['2027-01-08', 'b4e0'],
  ]) {
    const e = exerciseOf(date, id);
    const key = setKey(date, e, 0);
    const map = heads(changeEvents(completionChanges({}, [{ key, exercise: e }], date, date)));
    assert.equal(isSetComplete(map, key), true);
    assert.deepEqual(resultEntries(map), []);
  }
});
test('Ticking a run records its planned distance without a time', () => {
  const run = exerciseOf('2026-10-13', 'b1e0');
  const key = setKey('2026-10-13', run, 0);
  const events = changeEvents(
    completionChanges({}, [{ key, exercise: run }], '2026-10-13', '2026-10-13'),
  );
  assert.equal(validateEvents(events), true);
  const [result] = resultEntries(heads(events));
  assert.equal(result.value, 1);
  assert.equal(result.seconds, undefined);
});
test('Unticking removes a number that ticking recorded but keeps one you entered', () => {
  const hold = exerciseOf('2026-10-13', 'b2e0');
  const key = setKey('2026-10-13', hold, 0);
  const untick = (events) => {
    const map = heads(events);
    return [...events, ...changeEvents(untickChanges(map, key, '2026-10-13', '2026-10-13'), map)];
  };
  const ticked = changeEvents(
    completionChanges({}, [{ key, exercise: hold }], '2026-10-13', '2026-10-13'),
  );
  const afterTick = heads(untick(ticked));
  assert.equal(isSetComplete(afterTick, key), false);
  assert.deepEqual(resultEntries(afterTick), []);
  const entered = event('entered', key, {
    value: 25,
    unit: 'sec',
    name: 'Hollow Hold',
    variation: 'tucked',
    assistance: '',
    sides: false,
    day: '2026-10-13',
    actualDate: '2026-10-13',
  });
  assert.equal(resultEntries(heads(untick([entered])))[0].value, 25);
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
  const pullUps = exerciseOf('2026-10-19', 'b1e0');
  const changes = completionChanges(
    map,
    [0, 1].map((i) => ({ key: setKey('2026-10-19', pullUps, i), exercise: pullUps })),
    '2026-10-19',
    '2026-10-19',
  );
  assert.deepEqual(
    changes.map((c) => c.entity),
    ['completion:2026-10-19:b1e0:1', 'set:2026-10-19:b1e0:1'],
  );
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
  const pullUps = exerciseOf('2026-10-19', 'b1e0');
  assert.equal(
    completionChanges(map, [{ key, exercise: pullUps }], '2026-10-19', '2026-10-19').length,
    0,
  );
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
test('A prescription line leaves out the exercise name its heading already shows', () => {
  const line = (text) => prescriptionLine(sectionWith(text));
  assert.equal(line('Run: 1 mi easy'), '1 mi easy, walk breaks OK');
  assert.equal(line('A. Chin-Ups: 4×1'), '4×1 · rest 2 min');
  assert.equal(
    line('Mobility 10 min: hip'),
    'hip flexor stretch, deep squat hold, thoracic rotations',
  );
});
test('A prescription line keeps the variation named in its lead-in', () => {
  const line = (text) => prescriptionLine(sectionWith(text));
  assert.equal(line('Hollow Hold (tucked): 3×20s · rest 45s'), 'tucked · 3×20s · rest 45s');
  assert.equal(line('L-Sit (tuck hold, floor)'), 'tuck hold, floor · 3×10s · rest 60s');
  assert.equal(line('Single-Leg Calf Raises: 3×12/leg'), 'Single-Leg · 3×12/leg');
  assert.equal(line('Max Dead Hang'), 'Max · 1× max. Log it.');
});
test('Superset and test lines keep their wording, since it pairs names with numbers', () => {
  for (const text of [
    'B. Superset ×3: Push-Ups 10 → Bulgarian Split Squats 6/leg · rest 90s',
    'TEST: Pull-Ups, 1 max set. Log it. Then 2×3 easy · rest 2 min',
    'Full Hollow 3×20-30s and L-Sit 3×15-20s again. Best of Tue/Thu counts.',
  ])
    assert.equal(prescriptionLine(sectionWith(text)), text);
});
test('A section that tests one exercise twice is headed by its name once', () => {
  assert.equal(sectionWith('TEST: Pull-Ups, 1 max set.').name, 'Pull-Ups');
  assert.equal(
    sectionWith('B. Superset ×3: Push-Ups 10').name,
    'Push-Ups + Bulgarian Split Squats',
  );
});
test('Today summarizes a program once its last day has passed', () => {
  assert.equal(finishedProgramAt('2026-10-22', {}), null);
  assert.equal(finishedProgramAt('2027-01-10', {}), null);
  assert.equal(finishedProgramAt('2027-01-11', {}).id, '2026-10-13');
  assert.equal(finishedProgramAt('2026-10-01', {}), null);
});
test('The URL keeps the screen and the chosen day', () => {
  assert.deepEqual(screenFromHash('#/workout/2026-10-22'), { view: 'today', date: '2026-10-22' });
  assert.deepEqual(screenFromHash('#/progress'), { view: 'progress' });
  assert.deepEqual(screenFromHash('#/schedule'), { view: 'schedule' });
  assert.deepEqual(screenFromHash(''), { view: 'today' });
  assert.equal(hashForScreen({ view: 'today', date: '2026-10-22' }), '#/workout/2026-10-22');
  assert.equal(hashForScreen({ view: 'progress' }), '#/progress');
  assert.equal(hashForScreen({ view: 'today' }), '#/');
});
test('A URL with an unknown screen or a malformed date opens Today', () => {
  for (const hash of ['#/workout/oops', '#/settings', '#'])
    assert.deepEqual(screenFromHash(hash), { view: 'today' });
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
const at = (time) => `2026-10-19T${time}:00.000Z`;
const loggedAt = (date, sets, time) =>
  sets.map((set) => ({
    ...event(`tick-${date}-${set}-${time}`, `completion:${date}:${set}`, {
      completed: true,
      day: date,
      actualDate: date,
    }),
    at: at(time),
  }));
const clockEvent = (date, data, time = '10:00') => ({
  ...event(`clock-${date}-${time.replace(':', '')}`, `clock:${date}`, data),
  at: at(time),
});
test('The workout clock adds the running stretch to the time banked before it', () => {
  const started = startClock(undefined, Date.parse(at('10:00')));
  assert.deepEqual(started, { elapsed: 0, since: at('10:00') });
  assert.equal(clockSeconds(started, Date.parse(at('10:30'))), 1800);
  const paused = pauseClock(started, Date.parse(at('10:30')));
  assert.deepEqual(paused, { elapsed: 1800, since: null });
  assert.equal(clockSeconds(paused, Date.parse(at('12:00'))), 1800);
  const resumed = startClock(paused, Date.parse(at('11:00')));
  assert.equal(clockSeconds(resumed, Date.parse(at('11:15'))), 2700);
  assert.equal(clockSeconds(undefined, Date.now()), 0);
});
test('The workout clock stops at the tick that completes the workout', () => {
  const sets = requiredSets('2026-10-19');
  const map = heads([
    clockEvent('2026-10-19', { elapsed: 0, since: at('10:00') }),
    ...loggedAt('2026-10-19', sets.slice(0, -1), '10:20'),
    ...loggedAt('2026-10-19', sets.slice(-1), '10:48'),
  ]);
  assert.deepEqual(clockStops(map, Date.parse(at('11:00'))), [
    { entity: 'clock:2026-10-19', data: { elapsed: 2880, since: null }, idle: false },
  ]);
  assert.equal(
    workoutDuration(
      days.find((d) => d.date === '2026-10-19'),
      map,
    ),
    null,
  );
});
test('A clock resumed after the workout is complete keeps running, e.g. for a cool-down', () => {
  const map = heads([
    ...loggedAt('2026-10-19', requiredSets('2026-10-19'), '10:48'),
    clockEvent('2026-10-19', { elapsed: 2880, since: at('10:50') }, '10:50'),
  ]);
  assert.deepEqual(clockStops(map, Date.parse(at('11:00'))), []);
});
test('An incomplete workout keeps its clock running until nothing is logged for 3 hours', () => {
  const sets = requiredSets('2026-10-19');
  const map = heads([
    clockEvent('2026-10-19', { elapsed: 0, since: at('10:00') }),
    ...loggedAt('2026-10-19', sets.slice(0, 2), '10:30'),
  ]);
  assert.deepEqual(clockStops(map, Date.parse(at('13:29'))), []);
  assert.deepEqual(clockStops(map, Date.parse(at('13:31'))), [
    { entity: 'clock:2026-10-19', data: { elapsed: 1800, since: null }, idle: true },
  ]);
  const untouched = heads([clockEvent('2026-10-19', { elapsed: 600, since: at('10:00') })]);
  assert.deepEqual(clockStops(untouched, Date.parse(at('13:01'))), [
    { entity: 'clock:2026-10-19', data: { elapsed: 600, since: null }, idle: true },
  ]);
});
test('A workout duration counts only a stopped clock with time on it', () => {
  const day = days.find((d) => d.date === '2026-10-19');
  const of = (data) => workoutDuration(day, heads([clockEvent(day.date, data)]));
  assert.equal(of({ elapsed: 2880, since: null }), 2880);
  assert.equal(of({ elapsed: 0, since: null }), null);
  assert.equal(of({ elapsed: 600, since: at('10:00') }), null);
  assert.equal(workoutDuration(day, {}), null);
});
test('Conflicting clock edits stay for review while the clock reads the newest', () => {
  const map = heads([
    clockEvent('2026-10-19', { elapsed: 600, since: null }, '10:10'),
    clockEvent('2026-10-19', { elapsed: 900, since: null }, '10:15'),
  ]);
  assert.equal(map['clock:2026-10-19'].length, 2);
  assert.deepEqual(clockOf(map, '2026-10-19'), { elapsed: 900, since: null });
});
test('Clock records validate, and malformed ones are rejected', () => {
  assert.equal(
    validateEvents([clockEvent('2026-10-19', { elapsed: 0, since: at('10:00') })]),
    true,
  );
  assert.equal(validateEvents([clockEvent('2026-10-19', { elapsed: 2880, since: null })]), true);
  for (const data of [
    { elapsed: -1, since: null },
    { elapsed: 90000, since: null },
    { elapsed: 10, since: 'later' },
    { elapsed: 10 },
  ])
    assert.equal(validateEvents([clockEvent('2026-10-19', data)]), false);
});
test('Workout times read as a clock while running and in minutes once recorded', () => {
  assert.equal(formatClock(754), '12:34');
  assert.equal(formatClock(3725), '1:02:05');
  assert.equal(formatDuration(2880), '48 min');
  assert.equal(formatDuration(4380), '1 h 13 min');
});
const repeatEvent = (start, week = 'W1') =>
  event(`repeat-${start}`, repeatKey(start), { program: '2026-10-13', week, start });
const withRepeat = (...events) => heads([repeatEvent('2026-11-09'), ...events]);
test('Repeating W1 from Nov 9 slides the rest of the program back a week', () => {
  const map = withRepeat();
  const repeated = calendar(map);
  assert.equal(repeated.length, 97);
  assert.equal(new Set(repeated.map((d) => d.date)).size, 97);
  assert.equal(programsIn(map)[0].end, '2027-01-17');
  assert.equal(repeated.find((d) => d.date === '2027-01-16').title, '5K Victory Lap');
  const nov9 = repeated.find((d) => d.date === '2026-11-09');
  assert.equal(nov9.code, 'W1 (repeat)');
  assert.equal(nov9.week, 'W1');
  assert.equal(nov9.sections[1].text, days.find((d) => d.date === '2026-11-02').sections[1].text);
  assert.equal(repeated.find((d) => d.date === '2026-11-16').code, 'W2');
  assert.equal(programsIn(map)[0].weeks.slice(2, 6).join(), 'R3,W1,W1 (repeat),W2');
});
test('A repeated week leaves earlier workouts and their results alone', () => {
  const map = withRepeat(...tick('2026-11-02', requiredSets('2026-11-02')));
  const original = calendar(map).find((d) => d.date === '2026-11-02');
  assert.equal(original.code, 'W1');
  assert.equal(workoutStatus(original, map, '2026-11-07').id, 'complete');
  const missed = calendar(map).find((d) => d.date === '2026-11-03');
  assert.equal(workoutStatus(missed, map, '2026-11-07').id, 'empty');
  const again = calendar(map).find((d) => d.date === '2026-11-09');
  assert.equal(workoutStatus(again, map, '2026-11-07').id, 'upcoming');
});
test('A second repeat rewinds again and is labeled by how often the week has run', () => {
  const map = heads([repeatEvent('2026-11-09'), repeatEvent('2026-11-16')]);
  const repeated = calendar(map);
  assert.equal(repeated.find((d) => d.date === '2026-11-16').code, 'W1 (repeat 2)');
  assert.equal(repeated.find((d) => d.date === '2026-11-23').code, 'W2');
  assert.equal(programsIn(map)[0].end, '2027-01-24');
});
test('Choosing an earlier week runs every week after it again', () => {
  const map = heads([repeatEvent('2026-11-09', 'R3')]);
  const repeated = calendar(map);
  assert.equal(repeated.find((d) => d.date === '2026-11-09').code, 'R3 (repeat)');
  assert.equal(repeated.find((d) => d.date === '2026-11-16').code, 'W1 (repeat)');
  assert.equal(programsIn(map)[0].end, '2027-01-24');
});
const w1 = { program: '2026-10-13', week: 'W1' };
test('A repeat starts on its week’s weekday, today or later, after everything logged', () => {
  assert.equal(earliestRepeat({}, w1, '2026-11-07'), '2026-11-09');
  assert.equal(earliestRepeat({}, w1, '2026-11-09'), '2026-11-09');
  // R1 starts on a Tuesday.
  assert.equal(earliestRepeat({}, { ...w1, week: 'R1' }, '2026-11-07'), '2026-11-10');
  const logged = heads(tick('2026-11-09', requiredSets('2026-11-09'), '2026-11-07'));
  assert.equal(lastLoggedDate(logged), '2026-11-09');
  assert.equal(earliestRepeat(logged, w1, '2026-11-07'), '2026-11-16');
  assert.ok(previewRepeat(logged, { ...w1, start: '2026-11-09' }, '2026-11-07').problem);
  assert.ok(previewRepeat({}, { ...w1, start: '2026-11-10' }, '2026-11-07').problem);
  assert.equal(previewRepeat({}, { ...w1, start: '2026-11-09' }, '2026-11-07').end, '2027-01-17');
  assert.equal(previewRepeat({}, { ...w1, start: '2026-11-16' }, '2026-11-07').end, '2027-01-24');
});
test('A tick taken back or an empty clock does not hold a date', () => {
  const map = heads([
    event('unticked', 'completion:2026-11-09:b1e0:0', {
      completed: false,
      day: '2026-11-09',
      actualDate: '2026-11-07',
    }),
    event('idle', 'clock:2026-11-09', { elapsed: 0, since: null }),
  ]);
  assert.equal(lastLoggedDate(map), '');
});
test('A repeat clears moves and set counts on the dates it takes over, and no others', () => {
  const map = heads([
    event('future-move', 'schedule:2026-11-20', {
      due: '2026-11-21',
      originalDate: '2026-11-20',
      lateMove: false,
    }),
    event('missed-move', 'schedule:2026-11-05', {
      due: '2026-11-10',
      originalDate: '2026-11-05',
      lateMove: true,
    }),
    event('future-count', 'config:2026-11-20:b1e0', { count: 4 }),
  ]);
  const changes = repeatChanges(map, { ...w1, start: '2026-11-09' });
  assert.deepEqual(changes.map((c) => c.entity).sort(), [
    'config:2026-11-20:b1e0',
    'repeat:2026-11-09',
    'schedule:2026-11-20',
  ]);
  assert.equal(changes.find((c) => c.entity === 'schedule:2026-11-20').data, null);
});
test('A repeat can be undone until something is logged from its start on', () => {
  assert.equal(canUndoRepeat(withRepeat(), '2026-11-09'), true);
  assert.equal(canUndoRepeat(withRepeat(), '2026-11-16'), false);
  const earlier = withRepeat(...tick('2026-11-02', requiredSets('2026-11-02')));
  assert.equal(canUndoRepeat(earlier, '2026-11-09'), true);
  const logged = withRepeat(...tick('2026-11-09', requiredSets('2026-11-09')));
  assert.equal(canUndoRepeat(logged, '2026-11-09'), false);
  const undone = heads([
    repeatEvent('2026-11-09'),
    event('undo', repeatKey('2026-11-09'), null, ['repeat-2026-11-09']),
  ]);
  assert.equal(calendar(undone).length, 90);
  assert.equal(programsIn(undone)[0].end, '2027-01-10');
  assert.equal(canUndoRepeat(undone, '2026-11-09'), false);
});
test('Repeat events validate, and malformed ones are rejected', () => {
  assert.equal(validateEvents([repeatEvent('2026-11-09')]), true);
  assert.equal(validEventData('repeat:2026-11-09', { program: 'x', week: 'W1' }), false);
  assert.equal(validEventData('repeat:2026-11-09', null), true);
});
console.log(`\n${count} domain and data-integrity checks passed.`);
