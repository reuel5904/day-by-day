import {
  addDays,
  calendar,
  completionKey,
  effectiveDate,
  isFinished,
  isRunDay,
  isSetComplete,
  latest,
  mondayOf,
  programAt,
  programsIn,
  programDays,
  resultEntries,
  setCount,
  setKey,
  streaks,
  workoutDuration,
  workoutSets,
  workoutStatus,
  type Day,
  type Event,
  type Program,
} from './training-model';

type History = Record<string, Event[]>;

export function completedKeys(day: Day, map: History) {
  return workoutSets(day, map)
    .filter(({ key }) => isSetComplete(map, key))
    .map(({ key, exercise }) => ({ key, unit: exercise.unit }));
}

export function calendarDay(date: string, map: History, today: string) {
  const scheduled = calendar(map).filter((day) => effectiveDate(day, map) === date);
  const workouts = scheduled.filter((day) => day.sections.length);
  const statuses = (workouts.length ? workouts : scheduled).map((day) =>
    workoutStatus(day, map, today),
  );
  const finished = statuses.filter(isFinished).length;
  const status = statuses.find((state) => state.id === 'conflict') ||
    (finished && finished === statuses.length
      ? {
          id: statuses.some((state) => state.id === 'legacy') ? 'legacy' : 'complete',
          label: 'Complete',
        }
      : null) ||
    (finished
      ? { id: 'partial', label: `${finished} of ${workouts.length} workouts complete` }
      : null) ||
    statuses.find((state) => ['partial', 'started', 'empty', 'upcoming'].includes(state.id)) ||
    statuses[0] || { id: 'off', label: 'No workout scheduled' };
  const target =
    workouts.find((day) => !isFinished(workoutStatus(day, map, today))) ||
    workouts[0] ||
    scheduled[0];
  return { status, target, workoutCount: workouts.length };
}

// Every number covers all programs; `thisProgram` repeats the counts for the program today is in.
export function progressSummary(map: History, today: string) {
  const days = calendar(map);
  const training = days.filter((day) => day.sections.length);
  const statuses = new Map(training.map((day) => [day.date, workoutStatus(day, map, today)]));
  const statusOf = (day: Day) => statuses.get(day.date)!;
  const isDone = (day: Day) => {
    const status = statusOf(day);
    return isFinished(status) && (!status.actualDate || status.actualDate <= today);
  };
  const results = resultEntries(map).filter((result) => result.actualDate <= today);
  const countsFor = (own: Day[]) => {
    const dates = new Set(own.map((day) => day.date));
    const finished = own.filter(isDone);
    const activeDates = new Set<string>();
    let sets = 0;
    for (const day of own) {
      const { actualDate } = statusOf(day);
      if (actualDate && actualDate <= today) activeDates.add(actualDate);
      for (const { key, unit } of completedKeys(day, map)) {
        const tickedOn =
          latest(map, completionKey(key))?.actualDate || latest(map, key)?.actualDate;
        if (tickedOn && tickedOn <= today) {
          activeDates.add(tickedOn);
          if (unit !== 'check' && unit !== 'run') sets++;
        }
      }
    }
    const measured = results.filter((result) => dates.has(result.day));
    for (const result of measured) activeDates.add(result.actualDate);
    return {
      completed: finished.length,
      sets,
      activeDays: activeDates.size,
      strength: finished.filter((day) => !isRunDay(day)).length,
      runs: finished.filter(isRunDay).length,
      distance: measured
        .filter((result) => result.unit === 'run')
        .reduce((sum, result) => sum + result.value, 0),
      measurements: measured.length,
    };
  };
  const programs = programsIn(map);
  const first = programs[0].start,
    last = programs.at(-1)!.end;
  const firstMonday = mondayOf(first);
  const weekCount =
    Math.round(
      (Date.parse(mondayOf(last) + 'T12:00:00') - Date.parse(firstMonday + 'T12:00:00')) /
        (7 * 86400000),
    ) + 1;
  const weeks = Array.from({ length: weekCount }, (_, i) => {
    const start = addDays(firstMonday, i * 7),
      end = addDays(start, 6);
    const planned = training.filter(
      (day) => effectiveDate(day, map) >= start && effectiveDate(day, map) <= end,
    );
    return {
      start,
      end,
      // The program whose first day falls in this week.
      programStart: programs.find((program) => program.start >= start && program.start <= end),
      planned: planned.length,
      completed: planned.filter(isDone).length,
      partial: planned.filter((day) => statusOf(day).id === 'partial').length,
    };
  });
  const current = programAt(today, map);
  return {
    ...countsFor(training),
    thisProgram: countsFor(training.filter((day) => day.program === current.id)),
    first,
    last,
    weeks,
    thisWeek: weeks.find((week) => week.start === mondayOf(today)),
    partial: training.filter((day) => statusOf(day).id === 'partial').length,
    inProgress: training.filter((day) => statusOf(day).id === 'started').length,
    restDays: days.filter((day) => !day.sections.length && effectiveDate(day, map) <= today).length,
  };
}

const score = (result: { value: number; right?: number; sides?: boolean }) =>
  result.sides ? Math.min(result.value, result.right ?? 0) : result.value;

// Each tested exercise's best result in the last week that tests it, and the best from the
// first week that did, when that was earlier: a final dead hang against the first one.
function testResults(map: History, program: Program) {
  const sets = programDays(program, map).flatMap((day) =>
    day.sections.flatMap((section) =>
      section.exercises
        .filter((exercise) => exercise.test)
        .flatMap((exercise) =>
          Array.from({ length: setCount(day, map, exercise) }, (_, i) => ({
            day,
            exercise,
            result: latest(map, setKey(day.date, exercise, i)),
          })),
        ),
    ),
  );
  const bestIn = (list: typeof sets) =>
    list
      .filter(({ result }) => result && !result.skipped)
      .map(({ result }) => ({
        value: result.value as number,
        ...(result.sides ? { right: result.right as number } : {}),
        variation: result.variation as string,
        date: result.actualDate as string,
        score: score(result),
      }))
      .sort((a, b) => b.score - a.score)[0];
  return [...new Set(sets.map((set) => set.exercise.name))]
    .map((name) => {
      const own = sets.filter((set) => set.exercise.name === name);
      const first = own[0].day.code,
        last = own.at(-1)!.day.code;
      const final = own.filter((set) => set.day.code === last);
      return {
        name,
        unit: own[0].exercise.unit,
        sides: own[0].exercise.sides,
        date: final[0].day.date,
        best: bestIn(final),
        baseline: first === last ? undefined : bestIn(own.filter((set) => set.day.code === first)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The best result for each exercise, variation, assistance and tempo, so a higher count at an
// easier variation never counts as a best for a harder one. Runs are left out.
export function personalBests(map: History, program?: Program) {
  const own = program && new Set(programDays(program, map).map((day) => day.date));
  const best: Record<string, any> = {};
  for (const result of resultEntries(map)) {
    if (result.unit === 'run' || (own && !own.has(result.day))) continue;
    const key = JSON.stringify([
      result.name,
      result.variation,
      result.assistance,
      result.tempo,
      result.unit,
      result.sides,
    ]);
    if (!best[key] || score(result) > best[key].score)
      best[key] = { ...result, score: score(result) };
  }
  return Object.values(best).sort(
    (a, b) => a.name.localeCompare(b.name) || a.variation.localeCompare(b.variation),
  );
}

export function programSummary(map: History, program: Program, today: string) {
  const training = programDays(program, map).filter((day) => day.sections.length);
  const durations = training
    .filter((day) => isFinished(workoutStatus(day, map, today)))
    .map((day) => workoutDuration(day, map))
    .filter((s) => s !== null);
  return {
    completed: training.filter((day) => isFinished(workoutStatus(day, map, today))).length,
    averageDuration: durations.length
      ? durations.reduce((sum, s) => sum + s, 0) / durations.length
      : null,
    planned: training.length,
    bestStreak: streaks(map, today, program).best,
    personalBests: personalBests(map, program),
    tests: testResults(map, program),
  };
}
