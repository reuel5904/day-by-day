import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const advancedTo = (name, variation) =>
  heads([event('advance-' + name, `stage:${name}`, { variation, previous: '' })]);
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
const daysOf = (program) => days.filter((d) => d.program === program);
const fundamentals = daysOf('2026-11-16');
test('The earlier program keeps all 34 dated days with their written prescriptions', () => {
  const earlier = daysOf('2026-10-13');
  assert.equal(earlier.length, 34);
  assert.equal(earlier[0].date, '2026-10-13');
  assert.equal(earlier.at(-1).date, '2026-11-15');
  assert.equal(programsIn({})[0].weeks.join(), 'R1,R2,R3,W1,W2');
  for (const d of days) for (const s of d.sections) assert.ok(s.text && s.exercises.length, d.date);
});
test('Fundamentals runs 70 days from Nov 16 to Jan 24, the day after the earlier program ends', () => {
  assert.equal(fundamentals.length, 70);
  assert.equal(fundamentals[0].date, '2026-11-16');
  assert.equal(fundamentals.at(-1).date, '2027-01-24');
  assert.deepEqual(
    programsIn({}).map((p) => [p.id, p.title, p.start, p.end]),
    [
      ['2026-10-13', 'Stronger by January', '2026-10-13', '2026-11-15'],
      ['2026-11-16', 'Fundamentals', '2026-11-16', '2027-01-24'],
    ],
  );
  assert.equal(programsIn({})[1].weeks.join(), 'F1,F2,F3,F4,F5,F6,F7,F8,F9,F10');
  // No date belongs to two programs, and none is skipped.
  assert.equal(new Set(days.map((d) => d.date)).size, 104);
  assert.equal(days.length, 104);
});
// What the owner sees for each exercise on a date: variation, sets × number, seconds down, rest.
const written = (date) =>
  fundamentals
    .find((d) => d.date === date)
    .sections.filter((s) => s.kind !== 'prep')
    .flatMap((s) =>
      s.exercises.map((e) =>
        [
          `${e.name} [${e.variation}] ${e.count}×${e.target || 'max'}`,
          e.unit === 'sec' ? 's' : e.unit === 'run' ? ' mi' : '',
          e.sides ? '/side' : '',
          e.tempo && ` @ ${e.tempo}`,
          s.rest ? ` · rest ${s.rest}` : '',
          e.test ? ' · test' : '',
        ].join(''),
      ),
    );
const fridayTests = ['Pull-Ups [Standard] 1×max · test', 'Dead Hang [Standard] 1×maxs · test'];
test('F1 starts every exercise at its written number', () => {
  const lower = [
    'Pike Push-Ups [Standard] 3×8 · rest 90',
    'Bulgarian Split Squats [Standard] 3×12/side · rest 90',
    'Glute Bridge [Single-Leg] 3×8/side · rest 60',
  ];
  const monday = [
    'Negative Pull-Ups [Standard] 4×3 @ 5s · rest 120',
    'Rows [Standard] 3×8 · rest 90',
    'Push-Ups [Standard] 3×16 · rest 90',
    ...lower,
  ];
  const core = [
    'Hanging Knee Raises [Standard] 3×8 · rest 60',
    'Hollow Hold [tucked] 3×30s · rest 45',
    'Side Plank [Standard] 2×50s/side · rest 45',
    'Calf Raises [single-leg] 3×12/side · rest 45',
  ];
  assert.deepEqual(written('2026-11-16'), monday);
  assert.deepEqual(written('2026-11-17'), [
    'Run [Easy run] 1×2.5 mi',
    'Strides [Standard] 4×15s',
    ...core,
  ]);
  assert.deepEqual(written('2026-11-18'), [
    'Negative Pull-Ups [chin-up grip] 4×3 @ 5s · rest 120',
    'Rows [Standard] 3×8 · rest 90',
    'Push-Ups [Decline] 3×10 · rest 90',
    ...lower,
  ]);
  assert.deepEqual(written('2026-11-19'), ['Run [Easy run] 1×2.5 mi', ...core]);
  assert.deepEqual(written('2026-11-20'), [...monday, ...fridayTests]);
  assert.deepEqual(written('2026-11-21'), ['Run [Easy run] 1×2.5 mi']);
  assert.deepEqual(written('2026-11-22'), []);
});
test('F5 moves to Tempo Bulgarians and a low straight-leg Hollow Hold at lower numbers', () => {
  const lower = [
    'Pike Push-Ups [Standard] 3×12 · rest 90',
    'Bulgarian Split Squats [Tempo Bulgarian] 3×10/side @ 3s · rest 90',
    'Glute Bridge [Single-Leg] 3×12/side · rest 60',
  ];
  const core = [
    'Hanging Knee Raises [Standard] 3×12 · rest 60',
    'Hollow Hold [low straight-leg] 3×15s · rest 45',
    'Side Plank [raised foot] 2×35s/side · rest 45',
    'Calf Raises [single-leg] 3×16/side · rest 45',
  ];
  assert.deepEqual(written('2026-12-15'), [
    'Run [Easy run] 1×3 mi',
    'Strides [Standard] 4×15s',
    ...core,
  ]);
  assert.deepEqual(written('2026-12-16'), [
    'Negative Pull-Ups [chin-up grip] 4×4 @ 6s · rest 120',
    'Rows [Standard] 3×12 · rest 90',
    'Push-Ups [Decline] 3×14 · rest 90',
    ...lower,
  ]);
  assert.deepEqual(written('2026-12-17'), ['Run [Easy run] 1×3 mi', ...core]);
  assert.deepEqual(written('2026-12-18'), [
    'Negative Pull-Ups [Standard] 4×4 @ 6s · rest 120',
    'Rows [Standard] 3×12 · rest 90',
    'Push-Ups [Standard] 3×20 · rest 90',
    ...lower,
    ...fridayTests,
  ]);
  assert.deepEqual(written('2026-12-19'), ['Run [Easy run] 1×3.5 mi']);
});
test('F6 deloads to 2 sets on the same variations as F5, without strides', () => {
  const lower = [
    'Pike Push-Ups [Standard] 2×8 · rest 90',
    'Bulgarian Split Squats [Tempo Bulgarian] 2×8/side @ 3s · rest 90',
    'Glute Bridge [Single-Leg] 2×8/side · rest 60',
  ];
  const runCore = [
    'Run [Easy run] 1×2 mi',
    'Hanging Knee Raises [Standard] 2×8 · rest 60',
    'Hollow Hold [low straight-leg] 2×15s · rest 45',
    'Side Plank [raised foot] 2×30s/side · rest 45',
    'Calf Raises [single-leg] 2×12/side · rest 45',
  ];
  assert.deepEqual(written('2026-12-22'), runCore);
  assert.deepEqual(written('2026-12-23'), [
    'Negative Pull-Ups [chin-up grip] 2×3 @ 6s · rest 120',
    'Rows [Standard] 2×10 · rest 90',
    'Push-Ups [Decline] 2×10 · rest 90',
    ...lower,
  ]);
  assert.deepEqual(written('2026-12-24'), runCore);
  assert.deepEqual(written('2026-12-25'), [
    'Negative Pull-Ups [Standard] 2×3 @ 6s · rest 120',
    'Rows [Standard] 2×10 · rest 90',
    'Push-Ups [Standard] 2×16 · rest 90',
    ...lower,
    ...fridayTests,
  ]);
  assert.deepEqual(written('2026-12-26'), ['Run [Easy run] 1×2.5 mi']);
  const sets = fundamentals
    .filter((d) => d.code === 'F6')
    .flatMap((d) => d.sections.filter((s) => s.kind === 'exercise' || s.kind === 'superset'))
    .flatMap((s) => s.exercises.filter((e) => !e.test).map((e) => e.count));
  assert.deepEqual([...new Set(sets)], [2]);
});
test('F7 moves Rows feet further forward and Pike Push-Ups feet raised at lower numbers', () => {
  const lower = [
    'Pike Push-Ups [feet raised] 3×6 · rest 90',
    'Bulgarian Split Squats [Tempo Bulgarian] 3×11/side @ 3s · rest 90',
    'Glute Bridge [Single-Leg] 3×13/side · rest 60',
  ];
  const core = [
    'Hanging Knee Raises [Standard] 3×13 · rest 60',
    'Hollow Hold [low straight-leg] 3×20s · rest 45',
    'Side Plank [raised foot] 2×40s/side · rest 45',
    'Calf Raises [single-leg] 3×17/side · rest 45',
  ];
  assert.deepEqual(written('2026-12-29'), [
    'Run [Easy run] 1×3 mi',
    'Strides [Standard] 4×15s',
    ...core,
  ]);
  assert.deepEqual(written('2026-12-30'), [
    'Negative Pull-Ups [chin-up grip] 4×4 @ 7s · rest 120',
    'Rows [feet further forward] 3×8 · rest 90',
    'Push-Ups [Decline] 3×15 · rest 90',
    ...lower,
  ]);
  assert.deepEqual(written('2026-12-31'), ['Run [Easy run] 1×3 mi', ...core]);
  assert.deepEqual(written('2027-01-01'), [
    'Negative Pull-Ups [Standard] 4×4 @ 7s · rest 120',
    'Rows [feet further forward] 3×8 · rest 90',
    'Push-Ups [Standard] 3×21 · rest 90',
    ...lower,
    ...fridayTests,
  ]);
  assert.deepEqual(written('2027-01-02'), ['Run [Easy run] 1×3.5 mi']);
});
test('F10 puts its tests first and drops everything else to 2 sets', () => {
  const rows = 'Rows [feet further forward] 2×8 · rest 90';
  const lower = [
    'Pike Push-Ups [feet raised] 2×6 · rest 90',
    'Bulgarian Split Squats [Tempo Bulgarian] 2×10/side @ 3s · rest 90',
    'Glute Bridge [Single-Leg] 2×10/side · rest 60',
  ];
  const runCore = [
    'Run [Easy run] 1×2 mi',
    'Hanging Knee Raises [Standard] 2×10 · rest 60',
    'Hollow Hold [low straight-leg] 2×30s · rest 45',
    'Side Plank [raised foot] 2×45s/side · rest 45',
    'Calf Raises [single-leg] 2×15/side · rest 45',
  ];
  assert.deepEqual(written('2027-01-18'), [
    'Pull-Ups [Standard] 1×max · rest 120 · test',
    'Negative Pull-Ups [Standard] 1×maxs · rest 120 · test',
    rows,
    ...lower,
  ]);
  assert.deepEqual(written('2027-01-19'), runCore);
  assert.deepEqual(written('2027-01-20'), [
    'Chin-Ups [Standard] 1×max · rest 120 · test',
    rows,
    'Push-Ups [Decline] 2×12 · rest 90',
    ...lower,
  ]);
  assert.deepEqual(written('2027-01-21'), runCore);
  assert.deepEqual(written('2027-01-22'), [
    'Push-Ups [Standard] 1×max · rest 120 · test',
    'Dead Hang [Standard] 1×maxs · rest 120 · test',
    rows,
    ...lower,
  ]);
  assert.deepEqual(written('2027-01-23'), ['Run [Easy run] 1×3 mi']);
});
const fundamentalsExercises = fundamentals.flatMap((d) =>
  d.sections.flatMap((s) => s.exercises.map((e) => ({ ...e, date: d.date, code: d.code }))),
);
test('Every Fundamentals set has one fixed number, except the max tests', () => {
  for (const d of fundamentals) for (const s of d.sections) assert.equal(s.alternatives, undefined);
  for (const e of fundamentalsExercises) {
    const where = `${e.date} ${e.name}`;
    assert.equal(e.progression, false, where);
    if (e.unit === 'check') continue;
    if (e.test) assert.equal(e.target, '', where);
    else assert.match(e.target, /^\d+(\.\d+)?$/, where);
  }
});
test('Negatives keep their seconds down apart from their rep count, on both grips', () => {
  const negatives = (weekday) =>
    fundamentals
      .filter((d) => d.title === 'Strength' && new Date(d.date + 'T12:00:00').getDay() === weekday)
      .map((d) => d.sections[1].exercises[0])
      .map((e) => `${e.name} [${e.variation}] ${e.count}×${e.target} ${e.unit} @ ${e.tempo}`);
  const weekly = ['4×3', '4×3', '4×3', '4×3', '4×4', '2×3', '4×4', '4×4', '4×5'];
  const seconds = [5, 6, 7, 8, 6, 6, 7, 8, 7];
  for (const [weekday, variation] of [
    [1, 'Standard'],
    [3, 'chin-up grip'],
    [5, 'Standard'],
  ])
    assert.deepEqual(
      negatives(weekday),
      weekly.map((sets, i) => `Negative Pull-Ups [${variation}] ${sets} reps @ ${seconds[i]}s`),
    );
  assert.equal(
    fundamentalsExercises.some(
      (e) => e.code === 'F10' && e.name === 'Negative Pull-Ups' && !e.test,
    ),
    false,
  );
});
test('Fundamentals marks exactly the five agreed tests, on the agreed days', () => {
  const tested = {};
  for (const e of fundamentalsExercises.filter((e) => e.test)) (tested[e.name] ??= []).push(e.date);
  const fridays = [
    '2026-11-20',
    '2026-11-27',
    '2026-12-04',
    '2026-12-11',
    '2026-12-18',
    '2026-12-25',
    '2027-01-01',
    '2027-01-08',
    '2027-01-15',
  ];
  assert.deepEqual(tested, {
    'Pull-Ups': [...fridays, '2027-01-18'],
    'Dead Hang': [...fridays, '2027-01-22'],
    'Negative Pull-Ups': ['2027-01-18'],
    'Chin-Ups': ['2027-01-20'],
    'Push-Ups': ['2027-01-22'],
  });
});
test('Strides follow every Tuesday run except in the deload and test weeks', () => {
  const strides = fundamentalsExercises.filter((e) => e.name === 'Strides');
  assert.deepEqual(
    strides.map((e) => e.code),
    ['F1', 'F2', 'F3', 'F4', 'F5', 'F7', 'F8', 'F9'],
  );
  for (const e of strides) assert.equal(new Date(e.date + 'T12:00:00').getDay(), 2);
});
test('Ticking a Fundamentals set records its number and written variation, whatever was stored', () => {
  const decline = fundamentalsExercises.find((e) => e.date === '2026-11-18' && e.id === 'b2e1');
  const stored = advancedTo('Push-Ups', 'Archer');
  assert.equal(currentVariation(stored, decline), 'Decline');
  const key = setKey('2026-11-18', decline, 0);
  const events = changeEvents(
    completionChanges(stored, [{ key, exercise: decline }], '2026-11-18', '2026-11-18'),
  );
  assert.equal(validateEvents(events), true);
  const [result] = resultEntries(heads(events));
  assert.equal(result.name, 'Push-Ups');
  assert.equal(result.value, 10);
  assert.equal(result.variation, 'Decline');
  const monday = fundamentalsExercises.find((e) => e.date === '2026-11-16' && e.id === 'b2e1');
  assert.equal(currentVariation(stored, monday), 'Standard');
});
test('The Fundamentals roadmap and its structured data agree line for line', () => {
  const roadmap = readFileSync('web/src/programs/2026-11-16/roadmap.md', 'utf8').replaceAll(
    '**',
    '',
  );
  const lines = roadmap.split('\n');
  assert.deepEqual(
    lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2)),
    fundamentals.flatMap((d) => d.sections.map((s) => s.text)),
  );
  const label = (date, opts) => new Date(date + 'T12:00:00').toLocaleDateString('en-US', opts);
  assert.deepEqual(
    lines.filter((l) => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) /.test(l)),
    fundamentals.map(
      (d) =>
        `${label(d.date, { weekday: 'short' })} ${label(d.date, { month: 'short', day: 'numeric' })} · ${d.title}`,
    ),
  );
  assert.deepEqual(
    lines.filter((l) => l.startsWith('## ')).map((l) => l.replace(/^## (\w+) · .* · /, '$1 ')),
    [...new Set(fundamentals.map((d) => `${d.code} ${d.phase}`))],
  );
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
test('A max dead hang is one hold, not three guessed sets', () => {
  const [e] = sectionWith('Max Dead Hang: 1× max.').exercises;
  assert.equal(e.count, 1);
  assert.equal(e.name, 'Dead Hang');
  assert.equal(e.unit, 'sec');
});
test('Do not confuse a two-leg variation with unilateral work', () => {
  const bridge = sectionWith(
    'D. Superset ×3: Pike chain 6-12 [Floor Pike] → Glute Bridge chain 15-20 [two-leg]',
  );
  assert.equal(bridge.exercises[1].sides, false);
});
test('Progression suggestions apply only to W1 and W2 rep ranges, never to pull-ups or chin-ups', () => {
  const advancing = days.flatMap((d) =>
    d.sections.flatMap((s) => s.exercises.filter((e) => e.progression).map(() => d.code)),
  );
  assert.deepEqual([...new Set(advancing)], ['W1', 'W2']);
  for (const d of days)
    for (const s of d.sections)
      for (const e of s.exercises.filter((e) => e.progression)) {
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
    ['2026-10-16', 'b5e0'],
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
  assert.equal(line('Max Dead Hang'), 'Max · 1× max. Log it.');
});
test('Superset lines keep their wording, since it pairs names with numbers', () => {
  for (const text of [
    'B. Superset ×3: Push-Ups 10 → Bulgarian Split Squats 6/leg · rest 90s',
    'B. Superset ×3: Push-Ups 12 → Bulgarian Split Squats 10/leg · rest 90s, then 1 more set of Push-Ups 12',
  ])
    assert.equal(prescriptionLine(sectionWith(text)), text);
});
test('A superset is headed by the names of both its exercises', () => {
  assert.equal(
    sectionWith('B. Superset ×3: Push-Ups 10').name,
    'Push-Ups + Bulgarian Split Squats',
  );
});
test('Today summarizes a program once its last day has passed', () => {
  assert.equal(finishedProgramAt('2026-10-22', {}), null);
  assert.equal(finishedProgramAt('2026-11-15', {}), null);
  // Fundamentals starts the day after the earlier program ends, so that one is never summarized.
  assert.equal(finishedProgramAt('2026-11-16', {}), null);
  assert.equal(finishedProgramAt('2027-01-24', {}), null);
  assert.equal(finishedProgramAt('2027-01-25', {}).id, '2026-11-16');
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
const repeatEvent = (start, week = 'F1') =>
  event(`repeat-${start}`, repeatKey(start), { program: '2026-11-16', week, start });
const withRepeat = (...events) => heads([repeatEvent('2026-11-23'), ...events]);
test('Repeating F1 from Nov 23 slides the rest of Fundamentals back a week', () => {
  const map = withRepeat();
  const repeated = calendar(map);
  assert.equal(repeated.length, 111);
  assert.equal(new Set(repeated.map((d) => d.date)).size, 111);
  assert.equal(programsIn(map)[0].end, '2026-11-15');
  assert.equal(programsIn(map)[1].end, '2027-01-31');
  // F10's long run, written for Sat Jan 23.
  assert.equal(repeated.find((d) => d.date === '2027-01-30').sections[0].text, 'Run: 3 mi easy');
  const nov23 = repeated.find((d) => d.date === '2026-11-23');
  assert.equal(nov23.code, 'F1 (repeat)');
  assert.equal(nov23.week, 'F1');
  assert.equal(nov23.sections[1].text, 'A. Negative Pull-Ups: 4×3 @ 5s · rest 2 min');
  assert.equal(repeated.find((d) => d.date === '2026-11-30').code, 'F2');
  assert.equal(programsIn(map)[1].weeks.slice(0, 3).join(), 'F1,F1 (repeat),F2');
});
test('A repeated week leaves earlier workouts and their results alone', () => {
  const map = withRepeat(...tick('2026-11-16', requiredSets('2026-11-16')));
  const original = calendar(map).find((d) => d.date === '2026-11-16');
  assert.equal(original.code, 'F1');
  assert.equal(workoutStatus(original, map, '2026-11-21').id, 'complete');
  const missed = calendar(map).find((d) => d.date === '2026-11-17');
  assert.equal(workoutStatus(missed, map, '2026-11-21').id, 'empty');
  const again = calendar(map).find((d) => d.date === '2026-11-23');
  assert.equal(workoutStatus(again, map, '2026-11-21').id, 'upcoming');
});
test('A second repeat rewinds again and is labeled by how often the week has run', () => {
  const map = heads([repeatEvent('2026-11-23'), repeatEvent('2026-11-30')]);
  const repeated = calendar(map);
  assert.equal(repeated.find((d) => d.date === '2026-11-30').code, 'F1 (repeat 2)');
  assert.equal(repeated.find((d) => d.date === '2026-12-07').code, 'F2');
  assert.equal(programsIn(map)[1].end, '2027-02-07');
});
test('Choosing an earlier week runs every week after it again', () => {
  // Dec 7 is where F4 is written to start.
  const map = heads([repeatEvent('2026-12-07', 'F2')]);
  const repeated = calendar(map);
  assert.equal(repeated.find((d) => d.date === '2026-12-07').code, 'F2 (repeat)');
  assert.equal(repeated.find((d) => d.date === '2026-12-14').code, 'F3 (repeat)');
  assert.equal(repeated.find((d) => d.date === '2026-12-21').code, 'F4');
  assert.equal(programsIn(map)[1].end, '2027-02-07');
});
const f1 = { program: '2026-11-16', week: 'F1' };
test('A repeat starts on its week’s weekday, today or later, after everything logged', () => {
  assert.equal(earliestRepeat({}, f1, '2026-11-21'), '2026-11-23');
  assert.equal(earliestRepeat({}, f1, '2026-11-23'), '2026-11-23');
  // R1 starts on a Tuesday.
  assert.equal(
    earliestRepeat({}, { program: '2026-10-13', week: 'R1' }, '2026-11-07'),
    '2026-11-10',
  );
  const logged = heads(tick('2026-11-23', requiredSets('2026-11-23'), '2026-11-21'));
  assert.equal(lastLoggedDate(logged), '2026-11-23');
  assert.equal(earliestRepeat(logged, f1, '2026-11-21'), '2026-11-30');
  assert.ok(previewRepeat(logged, { ...f1, start: '2026-11-23' }, '2026-11-21').problem);
  assert.ok(previewRepeat({}, { ...f1, start: '2026-11-24' }, '2026-11-21').problem);
  assert.equal(previewRepeat({}, { ...f1, start: '2026-11-23' }, '2026-11-21').end, '2027-01-31');
  assert.equal(previewRepeat({}, { ...f1, start: '2026-11-30' }, '2026-11-21').end, '2027-02-07');
});
test('A repeat that would run the earlier program into Fundamentals is refused', () => {
  const w1 = { program: '2026-10-13', week: 'W1', start: '2026-11-09' };
  assert.equal(
    previewRepeat({}, w1, '2026-11-07').problem,
    'That would run into Fundamentals, which starts Nov 16.',
  );
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
    event('future-move', 'schedule:2026-11-27', {
      due: '2026-11-28',
      originalDate: '2026-11-27',
      lateMove: false,
    }),
    event('missed-move', 'schedule:2026-11-19', {
      due: '2026-11-24',
      originalDate: '2026-11-19',
      lateMove: true,
    }),
    event('future-count', 'config:2026-11-27:b1e0', { count: 3 }),
  ]);
  const changes = repeatChanges(map, { ...f1, start: '2026-11-23' });
  assert.deepEqual(changes.map((c) => c.entity).sort(), [
    'config:2026-11-27:b1e0',
    'repeat:2026-11-23',
    'schedule:2026-11-27',
  ]);
  assert.equal(changes.find((c) => c.entity === 'schedule:2026-11-27').data, null);
});
test('A repeat can be undone until something is logged from its start on', () => {
  assert.equal(canUndoRepeat(withRepeat(), '2026-11-23'), true);
  assert.equal(canUndoRepeat(withRepeat(), '2026-11-30'), false);
  const earlier = withRepeat(...tick('2026-11-16', requiredSets('2026-11-16')));
  assert.equal(canUndoRepeat(earlier, '2026-11-23'), true);
  const logged = withRepeat(...tick('2026-11-23', requiredSets('2026-11-23')));
  assert.equal(canUndoRepeat(logged, '2026-11-23'), false);
  const undone = heads([
    repeatEvent('2026-11-23'),
    event('undo', repeatKey('2026-11-23'), null, ['repeat-2026-11-23']),
  ]);
  assert.equal(calendar(undone).length, 104);
  assert.equal(programsIn(undone)[1].end, '2027-01-24');
  assert.equal(canUndoRepeat(undone, '2026-11-23'), false);
});
test('Repeat events validate, and malformed ones are rejected', () => {
  assert.equal(validateEvents([repeatEvent('2026-11-23')]), true);
  assert.equal(validEventData('repeat:2026-11-09', { program: 'x', week: 'W1' }), false);
  assert.equal(validEventData('repeat:2026-11-09', null), true);
});
console.log(`\n${count} domain and data-integrity checks passed.`);
