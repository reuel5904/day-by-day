import assert from 'node:assert/strict';
import { build } from 'esbuild';
await build({
  entryPoints: ['web/src/progress-model.ts', 'web/src/training-model.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: '.work/progress-test',
  outExtension: { '.js': '.mjs' },
});
const { progressSummary, calendarDay, programSummary } =
  await import('../.work/progress-test/progress-model.mjs');
const { calendar, programsIn, heads, completionChanges, setKey, streaks, workoutStatus } =
  await import('../.work/progress-test/training-model.mjs');
const days = calendar({});
const programs = programsIn({});
const event = (id, entity, data, parents = []) => ({
  id,
  entity,
  data,
  parents,
  at: '2026-10-19T12:00:00.000Z',
});
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log('✓ ' + name);
};
const dayOf = (date) => days.find((day) => day.date === date);
// What ticking every box of a workout writes, through the same rules the app uses.
const tickAll = (date, actualDate = date) =>
  completionChanges(
    {},
    dayOf(date).sections.flatMap((s) =>
      s.exercises.flatMap((e) =>
        Array.from({ length: e.count }, (_, i) => ({ key: setKey(date, e, i), exercise: e })),
      ),
    ),
    date,
    actualDate,
  ).map((c, i) => event(`${date}-${i}`, c.entity, c.data));
const monday = dayOf('2026-10-19');
const completion = event('set', 'completion:2026-10-19:b1e0:0', {
  completed: true,
  day: monday.date,
  actualDate: monday.date,
});
test('Ticking every box of three workouts fills the workout stats without pressing Finish', () => {
  const map = heads(['2026-10-19', '2026-10-20', '2026-10-21'].flatMap((date) => tickAll(date)));
  const summary = progressSummary(map, '2026-10-22');
  assert.equal(summary.completed, 3);
  assert.equal(summary.thisWeek.completed, 3);
  assert.equal(summary.thisWeek.planned, 6);
  assert.equal(summary.strength, 2);
  assert.equal(summary.runs, 1);
  assert.equal(summary.distance, 1.5);
  assert.ok(summary.measurements > 0);
  assert.deepEqual(streaks(map, '2026-10-22'), { current: 3, best: 3 });
});
test('Sunday is a rest day without a check-in or workout credit', () => {
  const rest = dayOf('2026-10-18');
  assert.equal(workoutStatus(rest, {}, '2026-10-19').id, 'rest');
  const summary = progressSummary({}, '2026-10-19');
  assert.equal(summary.restDays, 1);
  assert.equal(summary.completed, 0);
  assert.equal(summary.activeDays, 0);
  assert.equal(summary.thisWeek.planned, 6);
});
test('One ticked set counts as activity while the workout is in progress', () => {
  const map = heads([completion]),
    summary = progressSummary(map, '2026-10-19');
  assert.equal(summary.sets, 1);
  assert.equal(summary.activeDays, 1);
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.completed, 0);
  assert.equal(workoutStatus(monday, map, '2026-10-19').id, 'started');
});
test('Unchecking removes set credit while retaining an explicitly recorded result', () => {
  const result = event('result', 'set:2026-10-19:b1e0:0', {
    unit: 'reps',
    value: 3,
    actualDate: monday.date,
    day: monday.date,
  });
  const unchecked = event('uncheck', completion.entity, { ...completion.data, completed: false }, [
    completion.id,
  ]);
  const summary = progressSummary(heads([completion, result, unchecked]), '2026-10-19');
  assert.equal(summary.sets, 0);
  assert.equal(summary.activeDays, 1);
  assert.equal(summary.measurements, 1);
});
test('Warm-up and run boxes count as activity but not as strength sets', () => {
  const warmup = event('warmup', 'completion:2026-10-19:b0e0:0', {
    completed: true,
    day: monday.date,
    actualDate: monday.date,
  });
  const run = event('run', 'completion:2026-10-20:b1e0:0', {
    completed: true,
    day: '2026-10-20',
    actualDate: '2026-10-19',
  });
  const summary = progressSummary(heads([warmup, run]), '2026-10-19');
  assert.equal(summary.sets, 0);
  assert.equal(summary.activeDays, 1);
});
test('Imported completion counts workouts but cannot invent training dates or completed sets', () => {
  const summary = progressSummary(
    heads([event('old', 'session:2026-10-16', { status: 'legacy-complete', actualDate: null })]),
    '2026-10-19',
  );
  assert.equal(summary.completed, 1);
  assert.equal(summary.activeDays, 0);
  assert.equal(summary.sets, 0);
  assert.equal(summary.measurements, 0);
});
test('Weekly totals use revised scheduled dates and exclude rest; actual days are deduplicated', () => {
  const moved = event('moved', 'schedule:2026-10-19', {
    due: '2026-10-18',
    originalDate: '2026-10-19',
    lateMove: false,
  });
  const summary = progressSummary(heads([...tickAll('2026-10-19'), moved]), '2026-10-19');
  assert.equal(summary.activeDays, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.strength, 1);
  assert.equal(summary.weeks[0].completed, 1);
  assert.equal(summary.thisWeek.planned, 5);
  assert.equal(summary.thisWeek.completed, 0);
});
test('Partial workouts and conflicting set edits do not earn completed workout credit', () => {
  const conflict = event('other', completion.entity, { ...completion.data, completed: false });
  const partial = event('partial', 'session:2026-10-19', {
    status: 'partial',
    actualDate: '2026-10-19',
  });
  const summary = progressSummary(heads([completion, conflict, partial]), '2026-10-19');
  assert.equal(summary.partial, 1);
  assert.equal(summary.completed, 0);
  assert.equal(summary.sets, 0);
});
test('Unrecorded future workouts are upcoming rather than missed', () => {
  assert.equal(workoutStatus(monday, {}, '2026-10-18').id, 'upcoming');
  assert.equal(workoutStatus(monday, {}, '2026-10-20').id, 'empty');
});
test('A workout moved onto Sunday remains visible and mixed completion is explicit', () => {
  const move = event('move', 'schedule:2026-10-19', {
    due: '2026-10-18',
    originalDate: '2026-10-19',
    lateMove: false,
  });
  const cell = calendarDay('2026-10-18', heads([move]), '2026-10-19');
  assert.equal(cell.status.id, 'empty');
  assert.equal(cell.target.date, '2026-10-19');
  const move2 = event('move2', 'schedule:2026-10-20', {
    due: '2026-10-18',
    originalDate: '2026-10-20',
    lateMove: false,
  });
  const finished = tickAll('2026-10-19', '2026-10-18');
  const mixed = calendarDay('2026-10-18', heads([move, move2, ...finished]), '2026-10-19');
  assert.equal(mixed.status.id, 'partial');
  assert.equal(mixed.status.label, '1 of 2 workouts complete');
  assert.equal(mixed.target.date, '2026-10-20');
});
// A number entered for one set, as the result logger saves it.
const logged = (date, id, i, value, extra = {}) => {
  const e = dayOf(date)
    .sections.flatMap((s) => s.exercises)
    .find((e) => e.id === id);
  return event(`${date}-${id}-${i}`, setKey(date, e, i), {
    value,
    ...(e.sides ? { right: value } : {}),
    unit: e.unit,
    name: e.name,
    variation: e.variation,
    assistance: '',
    sides: e.sides,
    day: date,
    actualDate: date,
    ...extra,
  });
};
test('The program summary reports the one test the program has, the Oct 16 dead hang', () => {
  const map = heads([
    logged('2026-10-16', 'b5e0', 0, 30),
    // Later max dead hangs are not marked as tests, so they never replace it.
    logged('2026-11-13', 'b5e0', 0, 45),
  ]);
  const { tests } = programSummary(map, programs[0], '2026-11-16');
  assert.deepEqual(
    tests.map((t) => [t.name, t.best?.value, t.best?.date, t.baseline]),
    [['Dead Hang', 30, '2026-10-16', undefined]],
  );
  assert.deepEqual(
    programSummary({}, programs[0], '2026-11-16').tests.map((t) => [t.name, t.best]),
    [['Dead Hang', undefined]],
  );
});
test('The Fundamentals summary takes the best of each test and compares it with the first week', () => {
  const map = heads([
    logged('2026-11-20', 'b5e0', 0, 0),
    logged('2026-11-20', 'b6e0', 0, 30),
    // A dead hang between the first and last weeks is neither the baseline nor the result.
    logged('2026-12-18', 'b6e0', 0, 60),
    logged('2027-01-18', 'b1e0', 0, 1),
    logged('2027-01-18', 'b2e0', 0, 12),
    logged('2027-01-22', 'b1e0', 0, 24),
    event('second-hang', 'config:2027-01-22:b2e0', { count: 2 }),
    logged('2027-01-22', 'b2e0', 0, 50),
    logged('2027-01-22', 'b2e0', 1, 55),
  ]);
  const summary = programSummary(map, programs[1], '2027-01-25');
  assert.equal(summary.planned, 60);
  assert.deepEqual(
    summary.tests.map((t) => [t.name, t.unit, t.best?.value, t.baseline?.value, t.baseline?.date]),
    [
      ['Pull-Ups', 'reps', 1, 0, '2026-11-20'],
      ['Negative Pull-Ups', 'sec', 12, undefined, undefined],
      ['Chin-Ups', 'reps', undefined, undefined, undefined],
      ['Dead Hang', 'sec', 55, 30, '2026-11-20'],
      ['Push-Ups', 'reps', 24, undefined, undefined],
    ],
  );
});
test('The program summary counts completed workouts against planned ones and the best streak', () => {
  const map = heads(
    ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-23'].flatMap((d) => tickAll(d)),
  );
  const summary = programSummary(map, programs[0], '2026-11-16');
  assert.equal(summary.completed, 4);
  assert.equal(summary.planned, 29);
  assert.equal(summary.bestStreak, 3);
  assert.equal(summary.averageDuration, null);
});
test('The program summary averages the recorded times of finished workouts', () => {
  const clock = (date, data) => event(`clock-${date}`, `clock:${date}`, data);
  const map = heads([
    ...['2026-10-19', '2026-10-20', '2026-10-21'].flatMap((d) => tickAll(d)),
    clock('2026-10-19', { elapsed: 2400, since: null }),
    clock('2026-10-20', { elapsed: 3600, since: null }),
    clock('2026-10-22', { elapsed: 600, since: null }),
  ]);
  assert.equal(programSummary(map, programs[0], '2026-11-16').averageDuration, 3000);
});
test('Personal bests compare results only within the same exercise variation', () => {
  const map = heads([
    logged('2026-10-13', 'b2e0', 0, 20),
    logged('2026-10-20', 'b2e0', 0, 25),
    logged('2026-10-22', 'b3e0', 0, 12),
    logged('2026-11-03', 'b3e0', 0, 15),
    logged('2026-11-05', 'b3e0', 0, 14),
    logged('2026-10-20', 'b1e0', 0, 1.5),
  ]);
  const { personalBests } = programSummary(map, programs[0], '2026-11-16');
  assert.deepEqual(
    personalBests.map((r) => [r.name, r.variation, r.score]),
    [
      ['Hollow Hold', 'tucked', 25],
      ['L-Sit', 'tuck', 15],
      ['L-Sit', 'tuck hold', 12],
    ],
  );
});
const counts = ({ completed, sets, activeDays, strength, runs, distance }) => ({
  completed,
  sets,
  activeDays,
  strength,
  runs,
  distance,
});
test('The numbers are all-time, with the current program’s beside them', () => {
  const first = ['2026-10-19', '2026-10-20', '2026-10-21'].flatMap((date) => tickAll(date));
  const second = ['2026-11-16', '2026-11-17'].flatMap((date) => tickAll(date));
  const summary = progressSummary(heads([...first, ...second]), '2026-11-18');
  const firstOnly = counts(progressSummary(heads(first), '2026-11-15'));
  const secondOnly = counts(progressSummary(heads(second), '2026-11-18'));
  assert.deepEqual(firstOnly, { ...firstOnly, completed: 3, strength: 2, runs: 1, distance: 1.5 });
  assert.deepEqual(secondOnly, { ...secondOnly, completed: 2, strength: 1, runs: 1 });
  assert.ok(firstOnly.sets > 0 && secondOnly.sets > 0 && secondOnly.distance > 0);
  assert.deepEqual(counts(summary.thisProgram), secondOnly);
  assert.deepEqual(
    counts(summary),
    Object.fromEntries(
      Object.keys(firstOnly).map((key) => [key, firstOnly[key] + secondOnly[key]]),
    ),
  );
});
test('All-time numbers do not drop when a new program starts, and this program’s restart', () => {
  const map = heads(['2026-10-19', '2026-10-20', '2026-10-21'].flatMap((date) => tickAll(date)));
  const lastDay = progressSummary(map, '2026-11-15');
  const firstDay = progressSummary(map, '2026-11-16');
  assert.deepEqual(counts(lastDay.thisProgram), counts(lastDay));
  assert.deepEqual(counts(firstDay), counts(lastDay));
  assert.deepEqual(counts(firstDay.thisProgram), {
    completed: 0,
    sets: 0,
    activeDays: 0,
    strength: 0,
    runs: 0,
    distance: 0,
  });
  assert.equal(firstDay.measurements, lastDay.measurements);
});
test('The weeks run from the first program’s first week to the last one’s, marking each start', () => {
  const summary = progressSummary({}, '2026-11-18');
  assert.equal(summary.weeks.length, 15);
  assert.equal(summary.weeks[0].start, '2026-10-12');
  assert.equal(summary.weeks.at(-1).end, '2027-01-24');
  assert.deepEqual(
    summary.weeks.flatMap((week, i) => (week.programStart ? [[i, week.programStart.id]] : [])),
    [
      [0, '2026-10-13'],
      [5, '2026-11-16'],
    ],
  );
  assert.equal(summary.thisWeek, summary.weeks[5]);
  assert.deepEqual([summary.thisWeek.completed, summary.thisWeek.planned], [0, 6]);
  assert.equal(summary.start, '2026-10-13');
  assert.equal(summary.end, '2027-01-24');
});
test('A week holding the end of one program and the start of the next counts both', () => {
  const moved = event('moved', 'schedule:2026-11-14', {
    due: '2026-11-17',
    originalDate: '2026-11-14',
    lateMove: false,
  });
  const map = heads([moved, ...tickAll('2026-11-14', '2026-11-17'), ...tickAll('2026-11-16')]);
  const summary = progressSummary(map, '2026-11-17');
  assert.deepEqual([summary.weeks[4].completed, summary.weeks[4].planned], [0, 5]);
  assert.deepEqual([summary.thisWeek.completed, summary.thisWeek.planned], [2, 7]);
  assert.equal(summary.completed, 2);
  assert.equal(summary.thisProgram.completed, 1);
});
test('Rest days elapsed count every program', () => {
  // Oct 18 and 25, Nov 1, 8 and 15 in the first program, then Nov 22 in the second.
  assert.equal(progressSummary({}, '2026-11-15').restDays, 5);
  assert.equal(progressSummary({}, '2026-11-23').restDays, 6);
});
console.log(`\n${count} progress checks passed.`);
