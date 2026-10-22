import {
  addDays,
  completionKey,
  days,
  effectiveDate,
  isFinished,
  isRunDay,
  isSetComplete,
  latest,
  mondayOf,
  programAt,
  programDays,
  resultEntries,
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
  const scheduled = days.filter((day) => effectiveDate(day, map) === date);
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

export function progressSummary(map: History, today: string, program: Program = programAt(today)) {
  const own = programDays(program);
  const training = own.filter((day) => day.sections.length);
  const statuses = new Map(training.map((day) => [day.date, workoutStatus(day, map, today)]));
  const statusOf = (day: Day) => statuses.get(day.date)!;
  const finished = training.filter((day) => {
    const status = statusOf(day);
    return isFinished(status) && (!status.actualDate || status.actualDate <= today);
  });
  const activeDates = new Set<string>();
  let sets = 0;
  for (const day of training) {
    const { actualDate } = statusOf(day);
    if (actualDate && actualDate <= today) activeDates.add(actualDate);
    for (const { key, unit } of completedKeys(day, map)) {
      const tickedOn = latest(map, completionKey(key))?.actualDate || latest(map, key)?.actualDate;
      if (tickedOn && tickedOn <= today) {
        activeDates.add(tickedOn);
        if (unit !== 'check' && unit !== 'run') sets++;
      }
    }
  }
  const measured = resultEntries(map).filter(
    (result) => result.actualDate <= today && own.some((day) => day.date === result.day),
  );
  for (const result of measured) activeDates.add(result.actualDate);
  const firstMonday = mondayOf(program.start);
  const weekCount =
    Math.round(
      (Date.parse(mondayOf(program.end) + 'T12:00:00') - Date.parse(firstMonday + 'T12:00:00')) /
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
      planned: planned.length,
      completed: planned.filter((day) => finished.includes(day)).length,
      partial: planned.filter((day) => statusOf(day).id === 'partial').length,
    };
  });
  return {
    completed: finished.length,
    sets,
    activeDays: activeDates.size,
    weeks,
    thisWeek: weeks.find((week) => week.start === mondayOf(today)),
    strength: finished.filter((day) => !isRunDay(day)).length,
    runs: finished.filter(isRunDay).length,
    partial: training.filter((day) => statusOf(day).id === 'partial').length,
    inProgress: training.filter((day) => statusOf(day).id === 'started').length,
    restDays: own.filter((day) => !day.sections.length && effectiveDate(day, map) <= today).length,
    distance: measured
      .filter((result) => result.unit === 'run')
      .reduce((sum, result) => sum + result.value, 0),
    measurements: measured.length,
  };
}
