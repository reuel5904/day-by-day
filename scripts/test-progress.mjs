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
const { progressSummary, calendarDay } = await import('../.work/progress-test/progress-model.mjs');
const { days, heads, completionChanges, setKey, streaks, workoutStatus } =
  await import('../.work/progress-test/training-model.mjs');
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
console.log(`\n${count} progress checks passed.`);
