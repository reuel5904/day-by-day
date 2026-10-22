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
export function completionChanges(
  map: Record<string, Event[]>,
  keys: string[],
  day: string,
  actualDate: string,
) {
  return keys
    .filter(
      (key) =>
        !isSetComplete(map, key) &&
        !(map[key]?.length > 1) &&
        !(map[completionKey(key)]?.length > 1),
    )
    .map((key) => ({ entity: completionKey(key), data: { completed: true, day, actualDate } }));
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
export function onTime(d: Day, map: Record<string, Event[]>) {
  const s = latest(map, `session:${d.date}`);
  return s?.status === 'complete' && s.actualDate && s.actualDate <= deadline(d, map);
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
          (data.value > 0 && Number.isFinite(data.seconds) && data.seconds > 0)) &&
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
