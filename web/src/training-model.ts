import ROUTINE from './routine';
export type Exercise = {
  id: string;
  name: string;
  variation: string;
  count: number;
  unit: 'reps' | 'sec' | 'run' | 'check';
  target: string;
  top: number | null;
  sides: boolean;
  rest: number;
  tempo: string;
  ambiguous: boolean;
};
export type Block = {
  id: string;
  raw: string;
  kind: 'superset' | 'exercise' | 'run' | 'prep';
  name: string;
  exercises: Exercise[];
  rest: number;
  alternatives?: string[];
};
export type Day = {
  date: string;
  title: string;
  weekday: string;
  extra: string;
  code: string;
  phase: string;
  note: string;
  items: string[];
  blocks: Block[];
};
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
const restSeconds = (raw: string, fallback = 0) => {
  const m = raw.match(/rest\s+(\d+)\s*(min|s)/i);
  return m ? +m[1] * (m[2] === 'min' ? 60 : 1) : fallback;
};
const clean = (s: string) =>
  s
    .replace(/^[A-D]\.\s*/, '')
    .replace(/^TEST:\s*/, '')
    .trim();
function exercise(raw: string, id: string, countOverride?: number, rest = 0): Exercise {
  const t = clean(raw);
  const [head, ...tail] = t.split(':');
  const prescription = tail.join(':') || t;
  let name = tail.length
    ? head
    : t.split(/\s+\d+\s*[×x]|\s+\d+\s*(?:max|sets)|\s+\d+-\d+|\s+\[/)[0];
  name = name
    .replace(/\s+\d.*$/, '')
    .replace(/\s+chain$/, '')
    .replace(/^Max\s+/, '')
    .replace(/\.$/, '');
  if (/Dead Hang/i.test(name)) name = 'Dead Hang';
  const canonical: Record<string, string> = {
    Push: 'Push-Ups',
    Squat: 'Bulgarian Split Squats',
    Pike: 'Pike Push-Ups',
    Diamond: 'Diamond Push-Ups',
  };
  name = canonical[name] || name;
  const bracket = t.match(/\[([^\]]+)\]/)?.[1];
  const parens = name.match(/\(([^)]+)\)/)?.[1];
  const matched = prescription.match(/(\d+)\s*[×x]\s*(\d+(?:-\d+)?)(s)?/i);
  const range = prescription.match(/(?:^|\s)(\d+)-(\d+)(s)?(?:\b|\/)/);
  const single = prescription.match(/(?:^|\s)(\d+)(s)?(?:\/|\s|$)/);
  const count =
    countOverride ??
    (matched
      ? +matched[1]
      : +(prescription.match(/(\d+)\s*sets/)?.[1] || (/max/i.test(t) ? 1 : 3)));
  const unit = /Hold|L-Sit|Plank|Hang|Hollow|Strides/i.test(name) ? 'sec' : 'reps';
  const target =
    matched?.[2] || (range ? `${range[1]}-${range[2]}` : countOverride && single ? single[1] : '');
  const top = target.includes('-') ? +target.split('-')[1] : null;
  let variation = parens || bracket?.split(/ or |,/)[0]?.replace(/\s+\d.*$/, '') || 'Standard';
  if (['Push-Ups', 'Bulgarian', 'Floor Pike', 'Diamond', 'two-leg'].includes(variation))
    variation = 'Standard';
  const sideText = t.replace(/\[[^\]]+\]/g, '') + ' ' + (bracket?.split(/ or |,/)[0] || '');
  const tempo =
    t.match(/@\s*(\d+s[^·]*)/)?.[1]?.trim() ||
    (/tempo/i.test(t) ? 'Follow the prescribed tempo' : '');
  return {
    id,
    name: name.replace(/\s*\([^)]*\)/g, '').replace(/\s+again.*$/, ''),
    variation,
    count,
    unit,
    target,
    top,
    sides: /\/(side|leg)|each leg|Single-Leg|Archer/i.test(sideText),
    rest,
    tempo,
    ambiguous: /\bor\b|current stage|W7 stage|2 shy|attempt|Best of|max/i.test(t),
  };
}
export function parseBlock(raw: string, index: number): Block {
  const id = `b${index}`;
  const t = clean(raw);
  const rest = restSeconds(raw);
  if (/^(Warm-up|Cool-down|Mobility)/i.test(t))
    return {
      id,
      raw,
      kind: 'prep',
      name: t.split(':')[0],
      rest: 0,
      exercises: [
        {
          id: id + 'e0',
          name: t.split(':')[0],
          variation: 'Standard',
          count: 1,
          unit: 'check',
          target: '',
          top: null,
          sides: false,
          rest: 0,
          tempo: '',
          ambiguous: false,
        },
      ],
    };
  if (/^Run:/i.test(t)) {
    const distance = t.match(/([\d.]+)\s*mi/)?.[1] || '';
    const e: Exercise = {
      id: id + 'e0',
      name: 'Run',
      variation: 'Easy run',
      count: 1,
      unit: 'run',
      target: distance,
      top: null,
      sides: false,
      rest: 0,
      tempo: '',
      ambiguous: false,
    };
    const es = [e];
    if (/Strides/.test(t))
      es.push({
        ...e,
        id: id + 'e1',
        name: 'Strides',
        variation: 'Standard',
        count: 4,
        unit: 'sec',
        target: '15',
      });
    return { id, raw, kind: 'run', name: 'Run', rest, exercises: es };
  }
  if (/Superset/.test(t)) {
    const rounds = +(t.match(/Superset\s*×(\d+)/)?.[1] || 3);
    const pair = t
      .replace(/^Superset\s*×\d+:\s*/, '')
      .split(' · ')[0]
      .split('→');
    const exercises = pair.map((s, i) => exercise(s.trim(), id + 'e' + i, rounds, rest));
    if (/then 1 more set/.test(t)) exercises[0].count += 1;
    return { id, raw, kind: 'superset', name: 'Superset', rest, exercises };
  }
  if (/Full Hollow.*and L-Sit/.test(t))
    return {
      id,
      raw,
      kind: 'exercise',
      name: 'Core tests',
      rest,
      exercises: [
        exercise('Full Hollow: 3×20-30s', id + 'e0', undefined, rest),
        exercise('L-Sit: 3×15-20s', id + 'e1', undefined, rest),
      ],
    };
  if (/1 max set.*Then 2×3/.test(t)) {
    const name = t.split(',')[0];
    return {
      id,
      raw,
      kind: 'exercise',
      name,
      rest,
      exercises: [
        {
          ...exercise(name + ': 1× max', id + 'e0', 1, rest),
          target: '',
          variation: 'Max test',
          ambiguous: true,
        },
        { ...exercise(name + ': 2×3 easy', id + 'e1', 2, rest), variation: 'Easy back-off' },
      ],
    };
  }
  const e = exercise(t, id + 'e0', undefined, rest);
  if (/attempt each leg/.test(t)) {
    e.count = 1;
    e.target = '';
    e.sides = true;
    e.name = 'Pistol squat';
    e.variation = 'Assisted';
  }
  if (!rest && /Hollow|Plank|Dead Bug/i.test(e.name)) e.rest = 45;
  if (!rest && /L-Sit/i.test(e.name)) e.rest = 60;
  if (!rest && /Calf/i.test(e.name)) e.rest = 30;
  return {
    id,
    raw,
    kind: 'exercise',
    name: e.name,
    rest: e.rest,
    exercises: [e],
    alternatives: /5×2-5 or 4×6-8/.test(t) ? ['5 × 2–5', '4 × 6–8'] : undefined,
  };
}
export const days: Day[] = ROUTINE.flatMap((w) =>
  w.days.map((d) => ({
    ...d,
    title: d.title.replace(' (today)', ''),
    code: w.code,
    phase: w.title,
    note: w.note,
    blocks: d.items.map(parseBlock),
  })),
);
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
    .filter((d) => d.items.length && deadline(d, map) <= today)
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
