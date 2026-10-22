import type { ExerciseName } from './exercises';
import { programs as programData } from './programs';

export type Unit = 'reps' | 'sec' | 'run' | 'check';
// How a program is written. Optional fields fall back to the defaults in toExercise/toSection.
export type ExerciseData = {
  id: string;
  name: ExerciseName;
  variation?: string;
  count: number;
  unit: Unit;
  target?: string;
  sides?: boolean;
  tempo?: string;
  progression?: boolean;
};
export type SectionData = {
  id: string;
  kind: 'superset' | 'exercise' | 'run' | 'prep';
  text: string;
  rest?: number;
  alternatives?: { count: number; target: string }[];
  exercises: ExerciseData[];
};
export type ProgramData = {
  id: string;
  title: string;
  summary: string;
  note: string;
  weeks: {
    code: string;
    title: string;
    note: string;
    days: { date: string; title: string; sections: SectionData[] }[];
  }[];
};
export type Exercise = {
  id: string;
  name: string;
  variation: string;
  count: number;
  unit: Unit;
  target: string;
  top: number | null;
  sides: boolean;
  tempo: string;
  progression: boolean;
};
export type Section = Omit<SectionData, 'rest' | 'exercises'> & {
  name: string;
  rest: number;
  exercises: Exercise[];
};
export type Day = {
  date: string;
  title: string;
  program: string;
  code: string;
  phase: string;
  note: string;
  sections: Section[];
};
export type Program = Omit<ProgramData, 'weeks'> & { start: string; end: string; weeks: string[] };
export type Event = { id: string; entity: string; parents: string[]; data: any; at: string };
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dateLabel = (
  s: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', opts);
export const addDays = (s: string, n: number) => {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localDate(d);
};
export const mondayOf = (s: string) => {
  const d = new Date(s + 'T12:00:00');
  return addDays(s, -((d.getDay() + 6) % 7));
};
export const formatTime = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(s % 60)
    .toString()
    .padStart(2, '0')}`;
export const topOf = (target: string) =>
  target.includes('-') ? Number(target.split('-')[1]) : null;
const toExercise = (e: ExerciseData): Exercise => ({
  id: e.id,
  name: e.name,
  variation: e.variation ?? 'Standard',
  count: e.count,
  unit: e.unit,
  target: e.target ?? '',
  top: topOf(e.target ?? ''),
  sides: e.sides ?? false,
  tempo: e.tempo ?? '',
  progression: e.progression ?? false,
});
const toSection = ({ rest, exercises, ...section }: SectionData): Section => ({
  ...section,
  name: exercises.map((e) => e.name).join(' + '),
  rest: rest ?? 0,
  exercises: exercises.map(toExercise),
});
export const days: Day[] = programData.flatMap((p) =>
  p.weeks.flatMap((w) =>
    w.days.map((d) => ({
      date: d.date,
      title: d.title,
      program: p.id,
      code: w.code,
      phase: w.title,
      note: w.note,
      sections: d.sections.map(toSection),
    })),
  ),
);
export const programs: Program[] = programData.map(({ weeks, ...p }) => {
  const own = days.filter((d) => d.program === p.id);
  return { ...p, start: own[0].date, end: own.at(-1)!.date, weeks: weeks.map((w) => w.code) };
});
// The program running on a date; between programs, the last one that started; before any, the first.
export const programAt = (date: string) =>
  programs.find((p) => p.start <= date && date <= p.end) ??
  programs.filter((p) => p.start <= date).at(-1) ??
  programs[0];
export const programDays = (program: Program) => days.filter((d) => d.program === program.id);
export const setKey = (day: string, e: Exercise, i: number) => `set:${day}:${e.id}:${i}`;
export const completionKey = (key: string) => key.replace(/^set:/, 'completion:');
export function isSetComplete(map: Record<string, Event[]>, key: string): boolean {
  const completion = map[completionKey(key)];
  if (completion?.length > 1 || map[key]?.length > 1) return false;
  const explicit = latest(map, completionKey(key));
  if (explicit) return explicit.completed === true;
  const result = latest(map, key);
  return Boolean(result && !result.skipped);
}
export const fixedTarget = (e: Exercise) =>
  e.unit !== 'check' && /^\d+(\.\d+)?$/.test(e.target) ? Number(e.target) : null;
export const currentVariation = (map: Record<string, Event[]>, e: Exercise): string =>
  latest(map, `stage:${e.name}`)?.variation || e.variation;
// Ticking a fixed-target set confirms its prescribed number (ADR-0007).
export function prescribedResult(
  map: Record<string, Event[]>,
  e: Exercise,
  day: string,
  actualDate: string,
) {
  const value = fixedTarget(e);
  if (value === null) return null;
  return {
    value,
    ...(e.sides ? { right: value } : {}),
    name: e.name,
    variation: currentVariation(map, e),
    assistance: '',
    unit: e.unit,
    sides: e.sides,
    tempo: e.tempo,
    day,
    actualDate,
    skipped: false,
    asPrescribed: true,
  };
}
const conflicted = (map: Record<string, Event[]>, key: string) =>
  map[key]?.length > 1 || map[completionKey(key)]?.length > 1;
export function completionChanges(
  map: Record<string, Event[]>,
  sets: { key: string; exercise: Exercise }[],
  day: string,
  actualDate: string,
) {
  return sets
    .filter(({ key }) => !isSetComplete(map, key) && !conflicted(map, key))
    .flatMap(({ key, exercise }) => {
      const existing = latest(map, key);
      const result =
        existing && !existing.skipped ? null : prescribedResult(map, exercise, day, actualDate);
      return [
        { entity: completionKey(key), data: { completed: true, day, actualDate } },
        ...(result ? [{ entity: key, data: result }] : []),
      ];
    });
}
export function untickChanges(
  map: Record<string, Event[]>,
  key: string,
  day: string,
  actualDate: string,
) {
  return [
    { entity: completionKey(key), data: { completed: false, day, actualDate } },
    ...(latest(map, key)?.asPrescribed ? [{ entity: key, data: null }] : []),
  ];
}

export function heads(events: Event[]) {
  const referenced = new Set(events.flatMap((e) => e.parents));
  const map: Record<string, Event[]> = {};
  for (const event of events) if (!referenced.has(event.id)) (map[event.entity] ??= []).push(event);
  for (const values of Object.values(map))
    values.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return map;
}
export const latest = (map: Record<string, Event[]>, key: string) =>
  map[key]?.length === 1 ? map[key][0].data : undefined;
export const mergeEvents = (a: Event[], b: Event[]) =>
  Array.from(new Map([...a, ...b].map((e) => [e.id, e])).values());
export const effectiveDate = (d: Day, map: Record<string, Event[]>) =>
  latest(map, `schedule:${d.date}`)?.due || d.date;
export function deadline(d: Day, map: Record<string, Event[]>) {
  const s = latest(map, `schedule:${d.date}`);
  if (!s) return d.date;
  if (s.missedDeadline) return s.missedDeadline;
  // Late moves recorded before missedDeadline existed fall back to the original date.
  return s.lateMove ? d.date : s.due;
}
export function moveWorkout(d: Day, map: Record<string, Event[]>, today: string, due: string) {
  const current = latest(map, `schedule:${d.date}`);
  const scheduled = effectiveDate(d, map);
  const missedDeadline = current?.lateMove
    ? current.missedDeadline
    : scheduled < today
      ? scheduled
      : undefined;
  return {
    due,
    originalDate: d.date,
    lateMove: Boolean(current?.lateMove) || scheduled < today,
    ...(missedDeadline ? { missedDeadline } : {}),
  };
}
export const setCount = (day: Day, map: Record<string, Event[]>, e: Exercise) =>
  latest(map, `config:${day.date}:${e.id}`)?.count || e.count;
export function workoutSets(day: Day, map: Record<string, Event[]>) {
  const sets = day.sections.flatMap((section) =>
    section.exercises.flatMap((exercise) =>
      Array.from({ length: setCount(day, map, exercise) }, (_, i) => ({
        key: setKey(day.date, exercise, i),
        exercise,
        optional: section.kind === 'prep',
      })),
    ),
  );
  // A workout made only of warm-up, cool-down or mobility items needs those ticked instead.
  return sets.some((set) => !set.optional)
    ? sets
    : sets.map((set) => ({ ...set, optional: false }));
}
const tickDate = (map: Record<string, Event[]>, key: string): string | undefined =>
  latest(map, completionKey(key))?.actualDate || latest(map, key)?.actualDate;
// The actual training date of a completed workout: the day its last required set was ticked.
export function completedOn(day: Day, map: Record<string, Event[]>): string | null {
  const required = workoutSets(day, map).filter((set) => !set.optional);
  if (!required.length || !required.every(({ key }) => isSetComplete(map, key))) return null;
  return (
    required
      .map(({ key }) => tickDate(map, key) ?? '')
      .sort()
      .at(-1) || null
  );
}
export type WorkoutStatus = {
  id: 'rest' | 'conflict' | 'legacy' | 'complete' | 'partial' | 'started' | 'empty' | 'upcoming';
  label: string;
  actualDate: string | null;
};
export function workoutStatus(
  day: Day,
  map: Record<string, Event[]>,
  today: string,
): WorkoutStatus {
  if (!day.sections.length) return { id: 'rest', label: 'Rest day', actualDate: null };
  if (map[`session:${day.date}`]?.length > 1)
    return { id: 'conflict', label: 'Review conflicting edits', actualDate: null };
  const session = latest(map, `session:${day.date}`);
  if (session?.status === 'legacy-complete')
    return { id: 'legacy', label: 'Imported completion', actualDate: null };
  const completed = completedOn(day, map);
  if (completed) return { id: 'complete', label: 'Complete', actualDate: completed };
  const lastTick =
    workoutSets(day, map)
      .filter(({ key }) => isSetComplete(map, key))
      .map(({ key }) => tickDate(map, key) ?? '')
      .sort()
      .at(-1) || null;
  const scheduled = effectiveDate(day, map);
  if (session?.status === 'partial')
    return { id: 'partial', label: 'Partial workout', actualDate: session.actualDate };
  if (lastTick)
    return scheduled < today
      ? { id: 'partial', label: 'Partial workout', actualDate: lastTick }
      : { id: 'started', label: 'In progress', actualDate: lastTick };
  if (scheduled < today) return { id: 'empty', label: 'Missed', actualDate: null };
  return {
    id: 'upcoming',
    label: scheduled === today ? 'Planned for today' : 'Upcoming workout',
    actualDate: null,
  };
}
export const isFinished = (status: WorkoutStatus) =>
  status.id === 'complete' || status.id === 'legacy';
export function onTime(d: Day, map: Record<string, Event[]>) {
  const completed = completedOn(d, map);
  return completed !== null && completed <= deadline(d, map);
}
export function streaks(map: Record<string, Event[]>, today: string) {
  const scheduled = days
    .filter((d) => d.sections.length && deadline(d, map) <= today)
    .sort(
      (a, b) => deadline(a, map).localeCompare(deadline(b, map)) || a.date.localeCompare(b.date),
    );
  let run = 0,
    best = 0;
  for (const d of scheduled) {
    if (onTime(d, map)) {
      run++;
      best = Math.max(best, run);
    } else if (deadline(d, map) < today) run = 0;
  }
  return { current: run, best };
}
export function resultEntries(map: Record<string, Event[]>) {
  return Object.entries(map)
    .filter(
      ([k, v]) =>
        k.startsWith('set:') &&
        v.length === 1 &&
        v[0].data &&
        !v[0].data.skipped &&
        v[0].data.unit !== 'check',
    )
    .map(([key, v]) => ({ key, ...v[0].data, at: v[0].at }));
}
export function validEventData(entity: string, data: any): boolean {
  if (data === null) return true;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const date = (v: unknown) =>
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v + 'T12:00:00'));
  const str = (v: unknown, max = 100) => typeof v === 'string' && v.length <= max;
  if (entity.startsWith('set:'))
    return (
      data.skipped === true ||
      (Number.isFinite(data.value) &&
        data.value >= 0 &&
        data.value <= 100000 &&
        ['reps', 'sec', 'run', 'check'].includes(data.unit) &&
        str(data.name) &&
        str(data.variation) &&
        str(data.assistance) &&
        typeof data.sides === 'boolean' &&
        (!data.sides || (Number.isFinite(data.right) && data.right >= 0 && data.right <= 100000)) &&
        (data.unit !== 'run' ||
          (data.value > 0 &&
            (data.seconds === undefined || (Number.isFinite(data.seconds) && data.seconds > 0)))) &&
        date(data.day) &&
        date(data.actualDate))
    );
  if (entity.startsWith('completion:'))
    return typeof data.completed === 'boolean' && date(data.day) && date(data.actualDate);
  if (entity.startsWith('session:'))
    return (
      ['complete', 'partial', 'legacy-complete'].includes(data.status) &&
      ((data.actualDate === null && data.status === 'legacy-complete') || date(data.actualDate))
    );
  if (entity.startsWith('notes:')) return str(data.text, 10000);
  if (entity.startsWith('schedule:'))
    return (
      date(data.due) &&
      date(data.originalDate) &&
      typeof data.lateMove === 'boolean' &&
      (data.missedDeadline === undefined || date(data.missedDeadline))
    );
  if (entity.startsWith('legacy:'))
    return (
      Array.isArray(data.checks) &&
      data.checks.length <= 100 &&
      data.checks.every((v: any) => typeof v === 'boolean') &&
      typeof data.complete === 'boolean'
    );
  if (entity.startsWith('config:'))
    return Number.isInteger(data.count) && data.count >= 1 && data.count <= 20;
  if (entity.startsWith('stage:')) return str(data.variation) && data.variation.length > 0;
  return false;
}
export function validateEvents(value: unknown): value is Event[] {
  return (
    Array.isArray(value) &&
    value.length <= 30000 &&
    value.every(
      (e) =>
        e &&
        typeof e.id === 'string' &&
        /^[\w-]{1,100}$/.test(e.id) &&
        typeof e.entity === 'string' &&
        e.entity.length < 250 &&
        /^(set|completion|session|config|stage|notes|schedule|legacy):/.test(e.entity) &&
        validEventData(e.entity, e.data) &&
        Array.isArray(e.parents) &&
        e.parents.length <= 100 &&
        e.parents.every((p: unknown) => typeof p === 'string' && p.length <= 100) &&
        typeof e.at === 'string' &&
        Number.isFinite(Date.parse(e.at)) &&
        e.data !== undefined &&
        JSON.stringify(e.data).length < 50000,
    )
  );
}
export const isRunDay = (d: Day) => d.sections.some((s) => s.kind === 'run');
