import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudOff,
  Dumbbell,
  Flame,
  Flag,
  Footprints,
  Leaf,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  addDays,
  completionChanges,
  completionKey,
  currentVariation,
  fixedTarget,
  isFinished,
  isSetComplete,
  dateLabel,
  Day,
  days,
  effectiveDate,
  Event,
  Exercise,
  formatTime,
  heads,
  isRunDay,
  latest,
  localDate,
  mergeEvents,
  mondayOf,
  moveWorkout,
  programAt,
  programDays,
  prescriptionLine,
  resultEntries,
  Section,
  setKey,
  streaks,
  topOf,
  untickChanges,
  validateEvents,
  workoutSets,
  workoutStatus,
  finishedProgramAt,
  hashForScreen,
  screenFromHash,
  type Screen,
} from './training-model';

type User = { id: string; name: string; email: string } | null;
import CloudAccount from './cloud-account';
import ProgressOverview from './progress-overview';
import ProgramSummary, { PersonalBestRows } from './program-summary';
import { personalBests } from './progress-model';
import { ALARM_SOUNDS, alarmSound, type AlarmSoundId } from './timer-sounds';
import { supabase } from './supabase';
import { syncHistory } from './cloud-sync';
import { addHistory, combineStores, readStore, storageKey, type Store } from './sync-store';
type TimerState = {
  end: number | null;
  remaining: number;
  duration: number;
  label: string;
  running: boolean;
  done?: boolean;
};
const TIMER_PRESETS = [30, 45, 60, 90, 120];
const SCREENS = [
  { id: 'today', icon: Dumbbell, label: 'Today’s workout', tab: 'Today' },
  { id: 'schedule', icon: CalendarDays, label: 'Your schedule', tab: 'Schedule' },
  { id: 'progress', icon: TrendingUp, label: 'Your progress', tab: 'Progress' },
] as const;
const idleTimer: TimerState = {
  end: null,
  remaining: 90,
  duration: 90,
  label: 'Ready when you are',
  running: false,
};
const firstToday = (today: string) => days.find((d) => d.date >= today)?.date || days.at(-1)!.date;
const remainingAt = (t: TimerState) =>
  t.running && t.end ? Math.max(0, Math.ceil((t.end - Date.now()) / 1000)) : t.remaining;
// Only the countdown re-renders while a timer runs, not the whole app.
function useTicker(running: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [running]);
}
function Countdown({ timer }: { timer: TimerState }) {
  useTicker(timer.running);
  return <>{formatTime(remainingAt(timer))}</>;
}
function TimerRing({ timer }: { timer: TimerState }) {
  useTicker(timer.running);
  const remaining = remainingAt(timer);
  return (
    <div className="timer-ring">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="90" />
        <circle
          className="timer-arc"
          cx="100"
          cy="100"
          r="90"
          strokeDasharray={565.5}
          strokeDashoffset={565.5 * (1 - Math.min(1, remaining / Math.max(1, timer.duration)))}
        />
      </svg>
      <div>
        <span className="timer-numbers">{formatTime(remaining)}</span>
      </div>
    </div>
  );
}
const unitLabel = (u: string) => (u === 'sec' ? 'seconds' : u === 'run' ? 'miles' : 'reps');
const sameResult = (a: any, b: any) =>
  a.name === b.name &&
  a.variation === b.variation &&
  a.assistance === b.assistance &&
  a.tempo === b.tempo &&
  a.unit === b.unit &&
  Boolean(a.sides) === Boolean(b.sides);

export default function TrainingApp({ user }: { user: User }) {
  const [screen, setScreen] = useState(() => screenFromHash(location.hash));
  useEffect(() => {
    const onHashChange = () => {
      setScreen(screenFromHash(location.hash));
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  // Every screen change goes through the URL, so refresh and the back button keep your place.
  const go = (next: Screen) => {
    const hash = hashForScreen(next);
    if (location.hash === hash) window.scrollTo({ top: 0, behavior: 'smooth' });
    else location.hash = hash;
  };
  const view = screen.view;
  const [today, setToday] = useState(() => localDate());
  const selected = screen.date ?? firstToday(today);
  const finished = view === 'today' && !screen.date ? finishedProgramAt(today) : null;
  const [store, setStore] = useState<Store>({ events: [], pending: [] });
  const storeRef = useRef<Store>(store);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Loading');
  const [toast, setToast] = useState('');
  const [bulkUndo, setBulkUndo] = useState<{ entity: string; before: any; appliedId: string }[]>(
    [],
  );
  const [settings, setSettings] = useState(false);
  const [modal, setModal] = useState<'finish' | 'move' | 'timer' | null>(null);
  const [customMinutes, setCustomMinutes] = useState('1');
  const [customSeconds, setCustomSeconds] = useState('30');
  const [customTimerError, setCustomTimerError] = useState('');
  const [actualDate, setActualDate] = useState('');
  const [loggingDate, setLoggingDate] = useState(() => localDate());
  const [moveDate, setMoveDate] = useState('');
  const [note, setNote] = useState('');
  const [sound, setSound] = useState<AlarmSoundId>('classic');
  const [muted, setMuted] = useState(false);
  const [alarmTest, setAlarmTest] = useState(false);
  const [timer, setTimer] = useState<TimerState>(idleTimer);
  const [timerOpen, setTimerOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const [exerciseFilter, setExerciseFilter] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const alarmNodes = useRef<OscillatorNode[]>([]);
  const wake = useRef<any>(null);
  const syncing = useRef(false);
  useEffect(() => {
    if (!settings && !modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const selector = 'button:not([disabled]), a[href], input:not([hidden]), select, textarea';
    const elements = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(selector) || []);
    elements()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettings(false);
        setModal(null);
      }
      if (event.key === 'Tab') {
        const list = elements();
        const first = list[0],
          last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [settings, modal]);
  const key = storageKey(user?.id);
  const active = useRef(true);
  const storageFailed = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const map = useMemo(() => heads(store.events), [store.events]);
  const day = days.find((d) => d.date === selected) || days[0];
  const status = workoutStatus(day, map, today);
  const recordedSessionDate = status.actualDate;
  useEffect(
    () => setLoggingDate(recordedSessionDate || today),
    [selected, today, recordedSessionDate],
  );
  const notify = useCallback((s: string) => setToast(s), []);
  const persist = useCallback(
    (next: Store, accepted: string[] = []) => {
      if (!active.current) return;
      let combined = combineStores(storeRef.current, next, accepted);
      try {
        combined = combineStores(readStore(localStorage, key), combined, accepted);
        localStorage.setItem(key, JSON.stringify(combined));
        storageFailed.current = false;
      } catch {
        storageFailed.current = true;
        setSyncStatus('Browser storage unavailable');
        notify('Device storage is unavailable. Export your results to keep a backup.');
      }
      storeRef.current = combined;
      setStore(combined);
    },
    [key, notify],
  );
  const write = useCallback(
    (entity: string, data: any) => {
      const event: Event = {
        id: crypto.randomUUID(),
        entity,
        parents: (heads(storeRef.current.events)[entity] || []).map((e) => e.id),
        data,
        at: new Date().toISOString(),
      };
      persist({
        events: [...storeRef.current.events, event],
        pending: [...storeRef.current.pending, event.id],
      });
    },
    [persist],
  );
  const writeMany = useCallback(
    (values: { entity: string; data: any }[]) => {
      const current = heads(storeRef.current.events);
      const events = values.map((v) => ({
        ...v,
        id: crypto.randomUUID(),
        parents: (current[v.entity] || []).map((e) => e.id),
        at: new Date().toISOString(),
      }));
      persist({
        events: [...storeRef.current.events, ...events],
        pending: [...storeRef.current.pending, ...events.map((e) => e.id)],
      });
      return events;
    },
    [persist],
  );
  const sync = useCallback(async () => {
    if (syncing.current || !active.current) return;
    if (!navigator.onLine) {
      setSyncStatus('Offline · saved here');
      return;
    }
    if (!user) {
      setSyncStatus('Saved in this browser');
      return;
    }
    syncing.current = true;
    setSyncStatus('Syncing');
    try {
      await syncHistory({
        client: supabase,
        userId: user.id,
        active: () => active.current,
        read: () => storeRef.current,
        save: persist,
      });
      if (active.current)
        setSyncStatus(
          storageFailed.current
            ? 'Synced · browser storage unavailable'
            : storeRef.current.pending.length
              ? 'Saved here · sync pending'
              : 'All changes synced',
        );
    } catch (error) {
      if (active.current) {
        setSyncStatus(navigator.onLine ? 'Saved here · sync pending' : 'Offline · saved here');
        if (error instanceof Error && error.message === 'Sign in again to sync.')
          notify(error.message);
      }
    } finally {
      syncing.current = false;
    }
  }, [user, persist, notify]);
  useEffect(() => {
    try {
      const raw = readStore(localStorage, key);
      storeRef.current = raw;
      setStore(raw);
      setMuted(localStorage.getItem('dbd-muted') === 'true');
      setSound(alarmSound(localStorage.getItem('dbd-alarm-sound')).id);
      const t = JSON.parse(localStorage.getItem('dbd-timer') || 'null');
      if (t && typeof t.remaining === 'number') setTimer(t);
    } catch {
      notify('Could not read saved data. You can restore a JSON backup in Settings.');
    }
    setLoaded(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.storageArea !== localStorage) return;
      try {
        const next = readStore(localStorage, key);
        storeRef.current = next;
        setStore(next);
      } catch {
        notify('Could not read history updated in another tab.');
      }
    };
    window.addEventListener('storage', onStorage);
    if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname))
      navigator.serviceWorker
        .register(new URL('sw.js', document.baseURI).href)
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => reg.active?.postMessage('CACHE_SHELL'))
        .catch(() => {});
    return () => window.removeEventListener('storage', onStorage);
  }, [key, notify]);
  let localCount = 0;
  if (user && settings) {
    try {
      const accountIds = new Set(store.events.map((event) => event.id));
      localCount = readStore(localStorage, storageKey()).events.filter(
        (event) => !accountIds.has(event.id),
      ).length;
    } catch {
      /* Keep unreadable local history untouched. */
    }
  }
  const addLocalHistory = () => {
    try {
      const incoming = readStore(localStorage, storageKey());
      persist(addHistory(storeRef.current, incoming.events));
      notify('Browser history added to your account. It will sync when online.');
    } catch {
      notify('Could not read browser history. Try importing an exported backup.');
    }
  };
  useEffect(() => {
    if (!loaded) return;
    void sync();
    const onOnline = () => {
      setToday(localDate());
      void sync();
    };
    const offline = () => setSyncStatus('Offline · saved here');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', onOnline);
    const interval = setInterval(onOnline, 45000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', onOnline);
      clearInterval(interval);
    };
  }, [loaded, sync]);
  useEffect(() => {
    if (!loaded || !store.pending.length) return;
    const t = setTimeout(() => void sync(), 1500);
    return () => clearTimeout(t);
  }, [store.pending.length, loaded, sync]);
  const savedNote: string = latest(map, `notes:${selected}`)?.text || '';
  useEffect(() => setNote(savedNote), [selected, savedNote]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const unlockAudio = async () => {
    try {
      audio.current ??= new (window.AudioContext || (window as any).webkitAudioContext)();
      await audio.current.resume();
      return audio.current.state === 'running';
    } catch {
      notify('Audio is unavailable in this browser. The timer still shows a visual alert.');
      return false;
    }
  };
  const testAlarm = async () => {
    if (await unlockAudio()) setAlarmTest(true);
  };
  const chooseSound = (value: string) => {
    const next = alarmSound(value).id;
    setSound(next);
    try {
      localStorage.setItem('dbd-alarm-sound', next);
    } catch {
      notify('Sound changed for this visit. Browser storage is unavailable.');
    }
  };
  const toggleMuted = () => {
    unlockAudio();
    setMuted(!muted);
    try {
      localStorage.setItem('dbd-muted', String(!muted));
    } catch {
      notify('Sound setting changed for this visit. Browser storage is unavailable.');
    }
  };
  const silenceAlarm = useCallback(() => {
    for (const osc of alarmNodes.current) {
      try {
        osc.stop();
      } catch {}
    }
    alarmNodes.current = [];
  }, []);
  const stopAlarm = useCallback(() => {
    silenceAlarm();
    setAlarmTest(false);
    setTimer((t) => ({ ...t, done: false }));
  }, [silenceAlarm]);
  const chime = useCallback(
    (test = false) => {
      if (muted && !test) return;
      const ctx = audio.current;
      if (!ctx || ctx.state !== 'running') return;
      alarmSound(sound).notes.forEach((note) => {
        const osc = ctx.createOscillator(),
          gain = ctx.createGain(),
          start = ctx.currentTime + note.offset;
        osc.type = note.wave;
        osc.frequency.setValueAtTime(note.frequency, start);
        if (note.endFrequency)
          osc.frequency.exponentialRampToValueAtTime(note.endFrequency, start + note.duration);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(note.volume, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + note.duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        alarmNodes.current.push(osc);
        osc.onended = () => {
          alarmNodes.current = alarmNodes.current.filter((n) => n !== osc);
          gain.disconnect();
          osc.disconnect();
        };
        osc.start(start);
        osc.stop(start + note.duration + 0.01);
      });
    },
    [muted, sound],
  );
  useEffect(() => {
    if ((!timer.done && !alarmTest) || (muted && !alarmTest)) return;
    chime(alarmTest);
    const repeat = setInterval(() => chime(alarmTest), 2400);
    return () => {
      clearInterval(repeat);
      silenceAlarm();
    };
  }, [timer.done, alarmTest, muted, chime, silenceAlarm]);
  useEffect(() => () => silenceAlarm(), [silenceAlarm]);
  useEffect(() => {
    if (!timer.running || !timer.end) return;
    const timeUp = () => {
      setTimer((t) => ({ ...t, running: false, end: null, remaining: 0, done: true }));
      notify('Time’s up. Your next set is ready.');
    };
    const t = setTimeout(timeUp, Math.max(0, timer.end - Date.now()));
    return () => clearTimeout(t);
  }, [timer.running, timer.end, notify]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem('dbd-timer', JSON.stringify(timer));
    } catch {
      /* The timer keeps running; it just won't survive a reload. */
    }
  }, [timer, loaded]);
  // Keep the screen on mid-workout and while resting, so the timer can sound.
  const keepAwake = status.id === 'started' || timer.running;
  useEffect(() => {
    if (!keepAwake) return;
    const request = async () => {
      try {
        if (document.visibilityState === 'visible' && 'wakeLock' in navigator)
          wake.current = await (navigator as any).wakeLock.request('screen');
      } catch {}
    };
    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      void wake.current?.release();
      document.removeEventListener('visibilitychange', request);
    };
  }, [keepAwake]);
  const startRest = (duration: number, label: string) => {
    if (!duration) return;
    unlockAudio();
    setTimer({
      end: Date.now() + duration * 1000,
      remaining: duration,
      duration,
      label,
      running: true,
    });
  };
  const toggleTimer = () => {
    unlockAudio();
    setTimer((t) =>
      t.running
        ? { ...t, remaining: remainingAt(t), end: null, running: false }
        : {
            ...t,
            end: Date.now() + (t.remaining || t.duration) * 1000,
            remaining: t.remaining || t.duration,
            running: true,
            done: false,
          },
    );
  };
  const addTime = () =>
    setTimer((t) => ({
      ...t,
      duration: Math.max(t.duration, remainingAt(t) + 30),
      end: t.running ? (t.end || Date.now()) + 30000 : null,
      remaining: remainingAt(t) + 30,
      done: false,
    }));
  const setRestDuration = (duration: number) => {
    stopAlarm();
    setTimer({
      ...idleTimer,
      duration,
      remaining: duration,
      label: TIMER_PRESETS.includes(duration) ? 'Rest timer' : 'Custom rest',
    });
  };
  const openCustomTimer = () => {
    setCustomMinutes(String(Math.floor(timer.duration / 60)));
    setCustomSeconds(String(timer.duration % 60));
    setCustomTimerError('');
    setModal('timer');
  };
  const applyCustomTimer = () => {
    const minutes = Number(customMinutes || 0),
      seconds = Number(customSeconds || 0);
    if (
      !Number.isInteger(minutes) ||
      !Number.isInteger(seconds) ||
      minutes < 0 ||
      minutes > 999 ||
      seconds < 0 ||
      seconds > 59 ||
      minutes * 60 + seconds < 1
    ) {
      setCustomTimerError('Enter at least 1 second, with seconds between 0 and 59.');
      return;
    }
    setRestDuration(minutes * 60 + seconds);
    setModal(null);
  };

  const chooseDay = (date: string) => go({ view: 'today', date });
  const due = (d: Day) => effectiveDate(d, map);
  const countFor = (e: Exercise) => latest(map, `config:${day.date}:${e.id}`)?.count || e.count;
  const prescribed = (section: Section, e: Exercise): Exercise => {
    const count = countFor(e);
    const option = section.alternatives?.find((a) => a.count === count);
    return option
      ? { ...e, count, target: option.target, top: topOf(option.target) }
      : { ...e, count };
  };
  const setsOf = (section: Section) =>
    section.exercises
      .map((e) => prescribed(section, e))
      .flatMap((e) =>
        Array.from({ length: e.count }, (_, i) => ({ key: setKey(day.date, e, i), exercise: e })),
      );
  const allSets = day.sections.flatMap(setsOf);
  const allSetKeys = allSets.map((set) => set.key);
  const doneKeys = allSetKeys.filter((k) => isSetComplete(map, k));
  const requiredKeys = workoutSets(day, map)
    .filter((set) => !set.optional)
    .map((set) => set.key);
  const requiredDone = requiredKeys.filter((k) => isSetComplete(map, k)).length;
  const percent = requiredKeys.length ? Math.round((requiredDone / requiredKeys.length) * 100) : 0;
  const weekStart = mondayOf(selected);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const planned = days.filter(
    (d) => d.sections.length && due(d) >= weekStart && due(d) <= addDays(weekStart, 6),
  );
  const completed = planned.filter((d) => isFinished(workoutStatus(d, map, today)));
  const streak = streaks(map, today);
  const results = resultEntries(map);
  const conflicts = Object.entries(map).filter(([, v]) => v.length > 1);
  const improvements = results
    .filter((r) => r.unit !== 'run')
    .map((r) => {
      const older = results.filter((p) => sameResult(p, r) && p.actualDate < r.actualDate);
      const score = r.sides ? Math.min(r.value, r.right) : r.value;
      const best = Math.max(...older.map((p) => (p.sides ? Math.min(p.value, p.right) : p.value)));
      return older.length && score > best ? { ...r, gain: score - best } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.actualDate.localeCompare(a.actualDate))
    .filter((r: any, i: number, list: any[]) => list.findIndex((x) => sameResult(x, r)) === i)
    .slice(0, 3);
  const originalChecks = latest(map, `legacy:${selected}`)?.checks || [];
  const program = programAt(day.date);
  const weekIndex = program.weeks.indexOf(day.code) + 1;
  const currentProgram = programAt(today);
  const programLength = programDays(currentProgram).length;
  const dayNumber = Math.max(
    1,
    Math.min(
      programLength,
      Math.round(
        (new Date(today + 'T12:00:00').getTime() -
          new Date(currentProgram.start + 'T12:00:00').getTime()) /
          86400000,
      ) + 1,
    ),
  );
  const previous = (e: Exercise, variation: string, assistance: string) =>
    results
      .filter(
        (r) =>
          r.name === e.name &&
          r.variation === variation &&
          r.assistance === assistance &&
          r.unit === e.unit &&
          r.tempo === e.tempo &&
          r.day !== selected &&
          r.actualDate <= loggingDate,
      )
      .sort((a, b) => a.actualDate.localeCompare(b.actualDate) || a.at.localeCompare(b.at))
      .at(-1);
  const validTrainingDate = () => {
    if (!loggingDate || loggingDate > today || loggingDate < days[0].date) {
      notify('Choose a valid actual training date before marking complete.');
      return false;
    }
    return true;
  };
  const afterSingleCompletion = (
    e: Exercise,
    i: number,
    section: Section,
    wasComplete: boolean,
  ) => {
    stopAlarm();
    if (wasComplete || e.unit === 'check' || e.unit === 'run') return;
    const other = section.exercises.filter((ex: Exercise) => ex.id !== e.id);
    const pairDone = other.every(
      (ex: Exercise) => i >= countFor(ex) || isSetComplete(map, setKey(day.date, ex, i)),
    );
    const hasNext = allSetKeys.some((k) => k !== setKey(day.date, e, i) && !isSetComplete(map, k));
    if (hasNext && (section.kind !== 'superset' || pairDone)) {
      const next = day.sections
        .flatMap((s) => s.exercises)
        .flatMap((ex) =>
          Array.from({ length: countFor(ex) }, (_, n) => ({ ex, n, key: setKey(day.date, ex, n) })),
        )
        .find((s) => s.key !== setKey(day.date, e, i) && !isSetComplete(map, s.key));
      startRest(
        section.rest,
        next ? `Up next: ${next.ex.name} · set ${next.n + 1}` : 'Rest & reset',
      );
    }
  };
  const toggleSet = (e: Exercise, i: number, section: Section) => {
    if (!validTrainingDate()) return;
    const k = setKey(day.date, e, i);
    if (map[k]?.length > 1 || map[completionKey(k)]?.length > 1) {
      setSettings(true);
      notify('Review the conflicting edits before changing this set.');
      return;
    }
    const done = isSetComplete(map, k);
    writeMany(
      done
        ? untickChanges(map, k, selected, loggingDate)
        : completionChanges(map, [{ key: k, exercise: e }], selected, loggingDate),
    );
    setBulkUndo([]);
    if (!done) afterSingleCompletion(e, i, section, false);
  };
  const checkAll = (sets: { key: string; exercise: Exercise }[], label: string) => {
    if (!validTrainingDate()) return;
    const changes = completionChanges(map, sets, selected, loggingDate);
    if (!changes.length) {
      notify('Everything here is already checked, or has an edit conflict to review.');
      return;
    }
    const written = writeMany(changes);
    setBulkUndo(
      changes.map((change, n) => ({
        entity: change.entity,
        before: latest(map, change.entity) ?? null,
        appliedId: written[n].id,
      })),
    );
    stopAlarm();
    const hasConflicts = sets.some(
      ({ key }) => map[key]?.length > 1 || map[completionKey(key)]?.length > 1,
    );
    notify(
      hasConflicts
        ? 'Available sets checked. Review the conflicting edits for the rest.'
        : `${label} checked. Fixed targets were recorded; add any other numbers anytime.`,
    );
  };
  const undoCheckAll = () => {
    const current = heads(storeRef.current.events);
    const changes = bulkUndo
      .filter(
        (change) =>
          current[change.entity]?.length === 1 && current[change.entity][0].id === change.appliedId,
      )
      .map((change) => ({ entity: change.entity, data: change.before }));
    if (changes.length) writeMany(changes);
    setBulkUndo([]);
    notify('Check all undone. Numbers you entered yourself are kept.');
  };
  const saveSet = (e: Exercise, i: number, data: any, section: Section) => {
    if (!validTrainingDate()) return;
    const k = setKey(day.date, e, i);
    const wasComplete = isSetComplete(map, k);
    unlockAudio();
    writeMany([
      {
        entity: k,
        data: {
          ...data,
          name: e.name,
          unit: e.unit,
          sides: data.sides ?? e.sides,
          tempo: e.tempo,
          day: day.date,
          actualDate: loggingDate,
          skipped: false,
        },
      },
      {
        entity: completionKey(k),
        data: { completed: true, day: selected, actualDate: loggingDate },
      },
    ]);
    afterSingleCompletion(e, i, section, wasComplete);
  };
  const finishEarly = () => {
    if (!actualDate || actualDate > today || actualDate < days[0].date) {
      notify('Choose an actual training date between the program start and today.');
      return;
    }
    const missing = allSetKeys.filter((k) => !isSetComplete(map, k));
    if (
      conflicts.some(
        ([k]) => allSetKeys.includes(k) || allSetKeys.some((key) => completionKey(key) === k),
      )
    ) {
      notify('Resolve this workout’s conflicting results before finishing.');
      setModal(null);
      setSettings(true);
      return;
    }
    const values: { entity: string; data: any }[] = missing
      .filter((k) => !latest(map, k))
      .map((entity) => ({ entity, data: { skipped: true, day: selected } }));
    values.push({
      entity: `session:${selected}`,
      data: { status: 'partial', actualDate, finishedAt: new Date().toISOString() },
    });
    writeMany(values);
    setBulkUndo([]);
    stopAlarm();
    setModal(null);
    setTimer((t) => ({ ...t, running: false, end: null, remaining: remainingAt(t) }));
    notify('Partial workout saved. Every ticked set counts.');
  };
  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 2, exportedAt: new Date().toISOString(), events: storeRef.current.events },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `day-by-day-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importData = async (file: File) => {
    try {
      if (file.size > 10000000) throw new Error('File is too large.');
      const data = JSON.parse(await file.text());
      if (data.version === 2 && validateEvents(data.events)) {
        const imported = data.events.filter(
          (e: Event) => !storeRef.current.events.some((x) => x.id === e.id),
        );
        persist({
          events: mergeEvents(storeRef.current.events, imported),
          pending: [...storeRef.current.pending, ...imported.map((e: Event) => e.id)],
        });
        notify(`Imported ${imported.length} records. Conflicting edits are preserved for review.`);
      } else throw new Error('Choose a Day by Day backup file.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not import this file.');
    }
  };
  const soundPicker = (id: string) => (
    <div className="timer-sound-picker">
      <label htmlFor={id}>Alarm sound</label>
      <select id={id} value={sound} onChange={(e) => chooseSound(e.target.value)}>
        {ALARM_SOUNDS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
  const compactTimer = (
    <>
      <div className="timer-mini-copy">
        <span className="eyebrow">{timer.done ? 'REST COMPLETE' : 'REST TIMER'}</span>
        <strong>
          <Countdown timer={timer} />
        </strong>
      </div>
      <button
        className="timer-play"
        aria-label={timer.running ? 'Pause timer' : 'Start timer'}
        onClick={toggleTimer}
      >
        {timer.running ? <Pause size={19} /> : <Play size={19} />}
      </button>
    </>
  );
  const recentWorkouts = days
    .map((d) => ({ day: d, status: workoutStatus(d, map, today) }))
    .filter(({ status }) => ['complete', 'partial', 'legacy'].includes(status.id))
    .sort((a, b) =>
      (b.status.actualDate || b.day.date).localeCompare(a.status.actualDate || a.day.date),
    )
    .slice(0, 10);
  const totalComplete = programDays(program).filter(
    (d) => d.sections.length && isFinished(workoutStatus(d, map, today)),
  ).length;
  const trendNames = Array.from(
    new Set(
      results
        .filter((r) => r.unit !== 'run')
        .map(
          (r) =>
            `${r.name} · ${r.variation} · ${r.assistance || 'unassisted'}${r.tempo ? ' · ' + r.tempo : ''}${r.sides ? ' · per side' : ''}`,
        ),
    ),
  );
  const chosenFilter = exerciseFilter || trendNames[0] || '';
  const trendResults = results
    .filter(
      (r) =>
        `${r.name} · ${r.variation} · ${r.assistance || 'unassisted'}${r.tempo ? ' · ' + r.tempo : ''}${r.sides ? ' · per side' : ''}` ===
        chosenFilter,
    )
    .sort((a, b) => a.actualDate.localeCompare(b.actualDate) || a.at.localeCompare(b.at));
  const runResults = results
    .filter((r) => r.unit === 'run')
    .sort((a, b) => a.actualDate.localeCompare(b.actualDate));
  const bests = personalBests(map).slice(0, 6);
  const reschedule = () => {
    if (!moveDate || moveDate < today || moveDate > program.end) {
      notify('Choose a date from today through the end of the program.');
      return;
    }
    write(`schedule:${selected}`, {
      ...moveWorkout(day, map, today, moveDate),
      movedAt: new Date().toISOString(),
    });
    setModal(null);
    notify('Workout moved. The original date remains in its history.');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            go({ view: 'today' });
          }}
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>
            day by day<span className="brand-period">.</span>
          </span>
        </a>
        <div className="sidebar-caption">YOUR DAILY PRACTICE</div>
        <nav aria-label="Main navigation">
          {SCREENS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? 'active' : ''}`}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => go({ view: id })}
            >
              <Icon size={20} />
              {label}
              {view === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="program-card">
          <div className="program-icon">
            <Flag size={19} />
          </div>
          <span className="eyebrow">THE BIG PICTURE</span>
          <h3>{currentProgram.title}.</h3>
          <p>{currentProgram.summary}</p>
          <div className="program-bar">
            <span style={{ width: `${(dayNumber / programLength) * 100}%` }} />
          </div>
          <div className="program-meta">
            <span>
              Day {dayNumber} of {programLength}
            </span>
            <span>{Math.round((dayNumber / programLength) * 100)}%</span>
          </div>
          <span className="program-label">PROGRAM TIMELINE</span>
          <button className="text-link" onClick={() => go({ view: 'schedule' })}>
            View your plan <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setSettings(true)}>
            <Settings2 size={19} />
            Settings & backup
          </button>
          <div className="profile">
            <span className="avatar">
              {user?.name && user.name !== 'Your training'
                ? user.name.slice(0, 1).toUpperCase()
                : 'R'}
            </span>
            <div>
              <strong>{user?.name || 'Your training'}</strong>
              <span>{user ? 'Personal training space' : 'On this device'}</span>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div>
            <span className="breadcrumb">
              YOUR TRAINING <ChevronRight size={13} />
              <b>
                {view === 'today'
                  ? finished
                    ? 'Program summary'
                    : due(day) === today
                      ? 'Today'
                      : 'Workout'
                  : view === 'schedule'
                    ? 'Schedule'
                    : 'Progress'}
              </b>
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="sync-indicator"
              aria-label={syncStatus}
              title={user ? 'Sync now' : 'Sign in to sync across devices'}
              onClick={() => {
                if (user) void sync();
                else setSettings(true);
              }}
            >
              {syncStatus === 'Syncing' ? (
                <LoaderCircle size={14} className="spin" />
              ) : syncStatus.includes('Offline') ? (
                <CloudOff size={14} />
              ) : (
                <Cloud size={14} />
              )}
              <span>{syncStatus}</span>
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button"
              aria-label={muted ? 'Enable timer sound' : 'Mute timer sound'}
              onClick={toggleMuted}
            >
              {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            </button>
            <button
              className="icon-button topbar-settings"
              aria-label="Settings and backup"
              onClick={() => setSettings(true)}
            >
              <Settings2 size={19} />
            </button>
          </div>
        </header>
        <main>
          {conflicts.length > 0 && (
            <button className="notice conflict-notice" onClick={() => setSettings(true)}>
              <CircleHelp size={17} />
              {conflicts.length} conflicting edits need review. Both versions are kept.
              <ArrowRight size={16} />
            </button>
          )}
          {finished && (
            <ProgramSummary
              map={map}
              program={finished}
              today={today}
              onOpen={(next) => go({ view: next })}
            />
          )}
          {view === 'today' && !finished && (
            <>
              <section className="week-strip" aria-label="Week navigation">
                <button
                  className="week-arrow"
                  aria-label="Previous week"
                  disabled={weekStart <= mondayOf(days[0].date)}
                  onClick={() => {
                    const target = days.find((d) => d.date === addDays(selected, -7));
                    if (target) chooseDay(target.date);
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
                {weekDays.map((date) => {
                  const workouts = days.filter((d) => due(d) === date);
                  const d = workouts[0];
                  const finished = d ? isFinished(workoutStatus(d, map, today)) : false;
                  const sel = workouts.some((x) => x.date === selected);
                  return (
                    <button
                      key={date}
                      disabled={!d}
                      className={`week-day ${sel ? 'selected' : ''} ${date === today ? 'is-today' : ''} ${d && !d.sections.length ? 'planned-rest' : ''}`}
                      title={
                        workouts.length > 1
                          ? `${workouts.length} sessions · tap again to switch`
                          : dateLabel(date)
                      }
                      onClick={() => {
                        if (!d) return;
                        const current = workouts.findIndex((x) => x.date === selected);
                        chooseDay(
                          workouts[current >= 0 ? (current + 1) % workouts.length : 0].date,
                        );
                      }}
                    >
                      <span>{dateLabel(date, { weekday: 'short' })}</span>
                      <strong>{dateLabel(date, { day: 'numeric' })}</strong>
                      <span
                        className={`day-marker ${finished ? 'done' : !d?.sections.length ? 'rest' : d && isRunDay(d) ? 'run' : 'strength'}`}
                      >
                        {finished ? (
                          <Check size={10} />
                        ) : !d?.sections.length ? (
                          <>
                            <Leaf size={11} />
                            <span className="week-rest-label">Rest</span>
                          </>
                        ) : (
                          <span />
                        )}
                      </span>
                      {date === today && <span className="today-label">TODAY</span>}
                    </button>
                  );
                })}
                <button
                  className="week-arrow"
                  aria-label="Next week"
                  disabled={addDays(weekStart, 7) > days.at(-1)!.date}
                  onClick={() => {
                    const target = days.find((d) => d.date === addDays(selected, 7));
                    if (target) chooseDay(target.date);
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </section>
              {due(day) !== day.date && (
                <div className="notice">
                  <CalendarDays size={17} />
                  Moved from {dateLabel(day.date)}. Your original schedule is preserved.
                </div>
              )}
              <div className="workout-layout">
                <div className="workout-column">
                  <header className="today-header">
                    <div>
                      <h1>{day.sections.length ? day.title : 'Rest day'}</h1>
                      <p>
                        <span>
                          {dateLabel(due(day), {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span>
                          Week {weekIndex} of {program.weeks.length}
                        </span>
                        {day.sections.length > 0 && (
                          <span>
                            {requiredDone} of {requiredKeys.length} sets
                          </span>
                        )}
                      </p>
                    </div>
                    {['complete', 'partial', 'legacy', 'empty', 'conflict'].includes(status.id) && (
                      <span className={`status-tag ${status.id}`}>{status.label}</span>
                    )}
                    {day.sections.length > 0 && (
                      <button
                        className="icon-button"
                        aria-label="Reschedule workout"
                        disabled={isFinished(status) || status.id === 'partial'}
                        onClick={() => {
                          setMoveDate(due(day) < today ? today : due(day));
                          setModal('move');
                        }}
                      >
                        <CalendarDays size={19} />
                      </button>
                    )}
                  </header>
                  {!!day.note && (
                    <p className="coach-note">
                      <strong>
                        {day.code} · {day.phase.split(' (')[0]}
                      </strong>
                      {day.note}
                    </p>
                  )}
                  {!day.sections.length && (
                    <p className="rest-note">
                      <Leaf size={18} />
                      No workout scheduled. Rest days keep your streak going.
                    </p>
                  )}
                  {day.sections.length > 0 && selected !== today && (
                    <label className="historical-date">
                      <span>
                        <CalendarDays size={16} />
                        Actual training date{' '}
                        <small>Used for these results, separately from the schedule.</small>
                      </span>
                      <input
                        type="date"
                        min={days[0].date}
                        max={today}
                        value={loggingDate}
                        onChange={(e) => setLoggingDate(e.target.value)}
                      />
                    </label>
                  )}
                  {day.sections.length > 0 && (
                    <section id="exercise-list" className="exercise-section">
                      <div className="workout-toolbar">
                        <div
                          className="session-progress"
                          role="progressbar"
                          aria-label="Sets complete"
                          aria-valuenow={requiredDone}
                          aria-valuemax={requiredKeys.length}
                        >
                          <span style={{ width: `${percent}%` }} />
                        </div>
                        {bulkUndo.length > 0 && (
                          <button className="undo-check-all" onClick={undoCheckAll}>
                            <RotateCcw size={14} />
                            Undo
                          </button>
                        )}
                        <button
                          className="check-all-button"
                          disabled={doneKeys.length === allSetKeys.length}
                          onClick={() => checkAll(allSets, 'Workout')}
                        >
                          <CheckCheck size={17} />
                          Check all
                        </button>
                      </div>
                      {day.sections.map((section, si) => {
                        const sets = setsOf(section);
                        const sectionDone = sets.every(({ key }) => isSetComplete(map, key));
                        return (
                          <article className="exercise-card" key={selected + section.id}>
                            <div className="exercise-card-head">
                              <div
                                className={`block-number ${sectionDone ? 'block-complete' : ''}`}
                              >
                                {sectionDone ? (
                                  <Check size={17} />
                                ) : (
                                  String(si + 1).padStart(2, '0')
                                )}
                              </div>
                              <div>
                                <span className="eyebrow">
                                  {section.kind === 'superset'
                                    ? `${Math.min(...section.exercises.map(countFor))} ROUNDS · SUPERSET`
                                    : section.kind === 'prep'
                                      ? 'PREPARE & RECOVER'
                                      : section.kind === 'run'
                                        ? 'ENDURANCE'
                                        : 'QUALITY OVER QUANTITY'}
                                </span>
                                <h3>{section.name}</h3>
                              </div>
                              {section.rest > 0 && (
                                <button
                                  className="rest-chip"
                                  onClick={() => startRest(section.rest, section.name)}
                                >
                                  <Timer size={13} />
                                  {formatTime(section.rest)}
                                </button>
                              )}
                              {sets.length > 1 && (
                                <button
                                  className="section-check-all"
                                  aria-label={`Check all in ${section.kind === 'superset' ? 'superset' : section.name} section`}
                                  disabled={sectionDone}
                                  onClick={() =>
                                    checkAll(
                                      sets,
                                      section.kind === 'superset' ? 'Section' : section.name,
                                    )
                                  }
                                >
                                  <CheckCheck size={16} />
                                  <span>Check all</span>
                                </button>
                              )}
                            </div>
                            <div className="prescription">
                              {prescriptionLine(section)}
                              {originalChecks[si] && (
                                <span className="legacy-tag">
                                  <Check size={12} />
                                  Previously checked · imported
                                </span>
                              )}
                            </div>
                            {section.alternatives && (
                              <label className="alternative-choice">
                                Follow the program’s set option
                                <select
                                  value={countFor(section.exercises[0])}
                                  onChange={(e) =>
                                    write(`config:${day.date}:${section.exercises[0].id}`, {
                                      count: +e.target.value,
                                    })
                                  }
                                >
                                  {section.alternatives.map((option) => (
                                    <option key={option.count} value={option.count}>
                                      {option.count} sets × {option.target.replace('-', '–')} reps
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                            {section.exercises.map((e) => (
                              <ExerciseLogger
                                key={selected + e.id}
                                exercise={prescribed(section, e)}
                                day={day}
                                map={map}
                                previous={previous}
                                onSave={(i, data) => saveSet(e, i, data, section)}
                                write={write}
                                notify={notify}
                                results={results}
                                onToggle={(i) => toggleSet(prescribed(section, e), i, section)}
                                onCheckAll={() =>
                                  checkAll(
                                    sets.filter((set) => set.exercise.id === e.id),
                                    e.name,
                                  )
                                }
                              />
                            ))}
                          </article>
                        );
                      })}
                      <section className="notes-card">
                        <label htmlFor="session-notes">
                          <BookOpen size={17} />A note for next time
                        </label>
                        <textarea
                          id="session-notes"
                          placeholder="How did it feel? Anything to remember?"
                          value={note}
                          maxLength={10000}
                          onChange={(e) => setNote(e.target.value)}
                          onBlur={() => {
                            if (note !== savedNote) write(`notes:${selected}`, { text: note });
                          }}
                        />
                        <span>Notes save when you leave the field.</span>
                      </section>
                      <div className="finish-workout">
                        <div>
                          <strong>
                            {status.id === 'complete'
                              ? 'You put in the work.'
                              : 'Every set is a step forward.'}
                          </strong>
                          <p>
                            {status.id === 'complete'
                              ? 'Workout complete. It counts as soon as every set is ticked.'
                              : status.id === 'partial'
                                ? 'Saved as a partial workout. Tick the rest to complete it.'
                                : 'It completes when every set is ticked. Warm-up and cool-down are optional.'}
                          </p>
                        </div>
                        {status.id === 'started' && (
                          <button
                            className="secondary"
                            onClick={() => {
                              if (note !== savedNote) write(`notes:${selected}`, { text: note });
                              setActualDate(loggingDate);
                              setModal('finish');
                            }}
                          >
                            <CheckCheck size={18} />
                            Finish early
                          </button>
                        )}
                      </div>
                    </section>
                  )}
                </div>
                <aside className="workout-aside">
                  <section className={`timer-card ${timer.done ? 'timer-done' : ''}`}>
                    <div className="card-heading">
                      <span>
                        <Timer size={17} />
                        REST & RESET
                      </span>
                      <button
                        className="icon-button"
                        aria-label="Test alarm"
                        onClick={() => void testAlarm()}
                      >
                        <Volume2 size={18} />
                      </button>
                    </div>
                    <TimerRing timer={timer} />
                    <div className="timer-controls">
                      <button
                        className="icon-button"
                        aria-label="Restart timer"
                        onClick={() => {
                          setTimer((t) => ({
                            ...t,
                            remaining: t.duration,
                            end: t.running ? Date.now() + t.duration * 1000 : null,
                            done: false,
                          }));
                        }}
                      >
                        <RotateCcw size={18} />
                      </button>
                      <button className="primary timer-start" onClick={toggleTimer}>
                        {timer.running ? <Pause size={17} /> : <Play size={17} />}{' '}
                        {timer.running
                          ? 'Pause'
                          : timer.remaining === 0
                            ? 'Restart'
                            : 'Start timer'}
                      </button>
                      <button className="icon-button" aria-label="Add 30 seconds" onClick={addTime}>
                        <Plus size={19} />
                      </button>
                    </div>
                    <div className="timer-presets">
                      {TIMER_PRESETS.map((s) => (
                        <button
                          className={timer.duration === s ? 'selected' : ''}
                          aria-pressed={timer.duration === s}
                          key={s}
                          onClick={() => setRestDuration(s)}
                        >
                          {s < 60 ? s + 's' : s / 60 + 'm'}
                        </button>
                      ))}
                      <button
                        className={`timer-custom-button ${!TIMER_PRESETS.includes(timer.duration) ? 'selected' : ''}`}
                        onClick={openCustomTimer}
                      >
                        <Settings2 size={13} />
                        {TIMER_PRESETS.includes(timer.duration)
                          ? 'Custom time…'
                          : `Custom · ${formatTime(timer.duration)}`}
                      </button>
                    </div>
                    {soundPicker('timer-alarm-sound')}
                    <div className="timer-foot">
                      <span className="status-dot" />
                      {muted ? 'Sound muted' : 'Sound on'}
                      <button onClick={() => void testAlarm()}>Test alarm</button>
                    </div>
                  </section>
                  <section className="weekly-card">
                    <div className="card-heading">
                      <span>
                        <CalendarDays size={16} />
                        {weekStart === mondayOf(today) ? 'THIS WEEK' : 'SELECTED WEEK'}
                      </span>
                      <span>
                        {dateLabel(weekStart)}–
                        {dateLabel(addDays(weekStart, 6), { day: 'numeric' })}
                      </span>
                    </div>
                    <div className="weekly-number">
                      {completed.length}
                      <span>/ {planned.length}</span>
                      <span className="weekly-caption">workouts completed</span>
                    </div>
                    <div className="weekly-bars">
                      {planned.map((d) => (
                        <span
                          key={d.date}
                          className={completed.includes(d) ? 'filled' : ''}
                          title={dateLabel(due(d))}
                        />
                      ))}
                    </div>
                    <div className="weekly-message">
                      {completed.length === planned.length && planned.length
                        ? 'A full week of showing up. Nice work.'
                        : completed.length
                          ? 'You’re building momentum. Keep it going.'
                          : 'A fresh week. A new chance to show up.'}
                    </div>
                  </section>
                  <section className="streak-card">
                    <div className="flame-icon">
                      <Flame size={23} />
                    </div>
                    <div>
                      <strong>
                        {streak.current}
                        <span>workout streak</span>
                      </strong>
                      <p>Rest days keep it going.</p>
                    </div>
                  </section>
                  <section className="momentum-card">
                    <span className="eyebrow">
                      <Sparkles size={14} />
                      RECENT WINS
                    </span>
                    {improvements.length ? (
                      improvements.map((r: any) => (
                        <div key={r.key}>
                          <strong>
                            +{r.gain} {r.unit}
                            {r.sides ? ' / side' : ''}
                          </strong>
                          <p>
                            {r.name} · {r.variation}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p>None yet.</p>
                    )}
                  </section>
                  <button className="progress-link" onClick={() => go({ view: 'progress' })}>
                    <div>
                      <span className="eyebrow">SMALL WINS ADD UP</span>
                      <strong>See how far you’ve come</strong>
                    </div>
                    <ArrowUpRight size={20} />
                  </button>
                  <div className="quiet-note">
                    <Leaf size={17} />
                    <p>
                      Consistency isn’t doing more.
                      <br />
                      It’s coming back.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {view === 'schedule' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {dateLabel(program.start, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                    — {dateLabel(program.end, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <h1>
                    {program.title}. <span>Day by day.</span>
                  </h1>
                  <p>{program.summary}</p>
                </div>
                <button className="secondary" onClick={() => go({ view: 'today' })}>
                  Jump to today
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="schedule-intro">
                <Flag size={23} />
                <div>
                  <strong>{programDays(program).length} days of building something.</strong>
                  <p>
                    {totalComplete} of{' '}
                    {programDays(program).filter((d) => d.sections.length).length} workouts
                    completed · {program.note}
                  </p>
                </div>
              </div>
              <div className="schedule-weeks">
                {program.weeks.map((code) => {
                  const list = programDays(program).filter((d) => d.code === code);
                  return (
                    <details className="schedule-week" key={code} open={code === day.code}>
                      <summary>
                        <div>
                          <span className="week-code">{code}</span>
                          <div>
                            <h2>{list[0].phase}</h2>
                            <span>
                              {dateLabel(list[0].date)} — {dateLabel(list.at(-1)!.date)}
                            </span>
                          </div>
                        </div>
                        <ChevronDown size={19} />
                      </summary>
                      <div className="schedule-days">
                        {list.map((d) => {
                          const status = workoutStatus(d, map, today);
                          return (
                            <button
                              key={d.date}
                              className={`schedule-day ${!d.sections.length ? 'rest-day' : ''} ${due(d) === today ? 'current-day' : ''}`}
                              onClick={() => chooseDay(d.date)}
                            >
                              <span className="schedule-date">
                                <b>{dateLabel(due(d), { weekday: 'short' })}</b>
                                <strong>{dateLabel(due(d), { day: 'numeric' })}</strong>
                              </span>
                              <span
                                className={`schedule-kind ${!d.sections.length ? 'recovery' : isRunDay(d) ? 'running' : 'strength'}`}
                              >
                                {!d.sections.length ? (
                                  <Leaf size={19} />
                                ) : isRunDay(d) ? (
                                  <Footprints size={19} />
                                ) : (
                                  <Dumbbell size={19} />
                                )}
                              </span>
                              <span className="schedule-day-copy">
                                <strong>{d.title}</strong>
                                <span>
                                  {due(d) !== d.date ? `Moved from ${dateLabel(d.date)} · ` : ''}
                                  {status.id === 'upcoming' && due(d) !== today
                                    ? `${d.sections.length} sections`
                                    : status.label}
                                </span>
                              </span>
                              {isFinished(status) ? (
                                <Check size={20} className="green" />
                              ) : (
                                <ArrowUpRight size={18} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            </>
          )}
          {view === 'progress' && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">THE WORK IS ADDING UP</span>
                  <h1>
                    Small wins. <span>Real progress.</span>
                  </h1>
                  <p>
                    See the work you’ve done, the habits you’re building, and your measured results.
                  </p>
                </div>
                <button className="secondary" onClick={exportData}>
                  <ArrowDownToLine size={16} />
                  Export history
                </button>
              </div>
              <ProgressOverview map={map} today={today} streak={streak} onChoose={chooseDay} />
              <div className="progress-grid">
                <section className="chart-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">PERFORMANCE, NOT GUESSWORK</span>
                      <h2>Stronger over time</h2>
                    </div>
                    <TrendingUp size={20} />
                  </div>
                  {trendNames.length > 0 ? (
                    <>
                      <select
                        className="trend-select"
                        aria-label="Exercise history"
                        value={chosenFilter}
                        onChange={(e) => setExerciseFilter(e.target.value)}
                      >
                        {trendNames.map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                      <TrendChart results={trendResults} />
                      <p className="chart-note">
                        Each point is a recorded set. For two-sided exercises, the lower side is
                        shown. Comparisons use the same variation, assistance, and tempo.
                      </p>
                    </>
                  ) : (
                    <p className="empty-line">No recorded results yet.</p>
                  )}
                </section>
                <section className="pb-card">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">YOUR OWN BENCHMARKS</span>
                      <h2>Personal bests</h2>
                    </div>
                    <Target size={20} />
                  </div>
                  <PersonalBestRows bests={bests} />
                </section>
              </div>
              <section className="run-history">
                <div className="section-heading">
                  <h2>Your running log</h2>
                  <Footprints size={21} />
                </div>
                {runResults.length ? (
                  <div className="run-table">
                    <div className="run-row run-table-head">
                      <span>Date</span>
                      <span>Distance</span>
                      <span>Time</span>
                      <span>Pace</span>
                    </div>
                    {runResults.map((r) => (
                      <div className="run-row" key={r.key}>
                        <span>{dateLabel(r.actualDate)}</span>
                        <strong>{r.value} mi</strong>
                        <span>{r.seconds ? formatTime(r.seconds) : '—'}</span>
                        <span>{r.seconds ? `${formatTime(r.seconds / r.value)} /mi` : '—'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-line">No runs logged yet.</p>
                )}
              </section>
              <section className="recent-history">
                <div className="section-heading">
                  <h2>Recent workouts</h2>
                  <CalendarDays size={20} />
                </div>
                {recentWorkouts.map(({ day: d, status }) => (
                  <button className="history-row" key={d.date} onClick={() => chooseDay(d.date)}>
                    <Dumbbell size={18} />
                    <strong>{d.title}</strong>
                    <span>
                      {status.actualDate
                        ? dateLabel(status.actualDate)
                        : 'Training date not recorded'}
                    </span>
                    <b>{status.label}</b>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
                {!recentWorkouts.length && <p className="empty-line">No workouts yet.</p>}
              </section>
            </>
          )}
          <footer className="page-footer">
            <span className="mini-brand">day by day.</span>
            <span>Show up. Put in the work. Come back stronger.</span>
            <Leaf size={15} />
          </footer>
        </main>
      </div>
      {view === 'today' && !finished && (
        <div className={`mobile-timer ${timerOpen ? 'expanded' : ''}`}>
          <button
            className="mobile-timer-toggle"
            aria-label={timerOpen ? 'Collapse timer' : 'Expand timer controls'}
            onClick={() => setTimerOpen((v) => !v)}
          >
            <Timer size={20} />
            <ChevronDown size={14} />
          </button>
          {compactTimer}
          {timerOpen && (
            <div className="mobile-timer-details">
              {soundPicker('mobile-alarm-sound')}
              <button
                className="secondary"
                onClick={() =>
                  setTimer((t) => ({
                    ...t,
                    running: false,
                    end: null,
                    remaining: t.duration,
                    done: false,
                  }))
                }
              >
                <RotateCcw size={16} />
                Reset
              </button>
              <button className="secondary" onClick={addTime}>
                +30 sec
              </button>
              <button className="secondary" onClick={() => void testAlarm()}>
                <Volume2 size={16} />
                Test
              </button>
              <select
                aria-label="Rest length"
                value={timer.duration}
                onChange={(e) =>
                  e.target.value === 'custom' ? openCustomTimer() : setRestDuration(+e.target.value)
                }
              >
                {Array.from(new Set([...TIMER_PRESETS, timer.duration])).map((s) => (
                  <option value={s} key={s}>
                    {s < 60 ? `${s} sec` : formatTime(s)}
                    {!TIMER_PRESETS.includes(s) ? ' (custom)' : ''}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              <button className="secondary mobile-custom-time" onClick={openCustomTimer}>
                <Settings2 size={15} />
                Custom time
              </button>
            </div>
          )}
        </div>
      )}
      <nav className="tab-bar" aria-label="Screens">
        {SCREENS.map(({ id, icon: Icon, tab }) => (
          <button
            key={id}
            className={view === id ? 'active' : ''}
            aria-current={view === id ? 'page' : undefined}
            onClick={() => go({ view: id })}
          >
            <Icon size={21} />
            {tab}
          </button>
        ))}
      </nav>
      {(timer.done || alarmTest) && (
        <div className="alarm-banner" role="alert">
          <Bell size={24} />
          <div>
            <strong>{alarmTest ? 'Alarm sound test' : 'Time’s up. Let’s go!'}</strong>
            <span>
              {alarmTest
                ? 'Repeats until you stop it.'
                : muted
                  ? 'Sound is muted.'
                  : 'Your next set is ready.'}
            </span>
          </div>
          <button className="primary" onClick={stopAlarm}>
            Stop alarm
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          {bulkUndo.length > 0 && (
            <button className="undo-bulk" onClick={undoCheckAll}>
              Undo
            </button>
          )}
          <button className="icon-button" aria-label="Dismiss message" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {(settings || modal) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setSettings(false);
            setModal(null);
          }}
        >
          <section
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              settings
                ? 'Settings and backup'
                : modal === 'finish'
                  ? 'Finish early'
                  : modal === 'timer'
                    ? 'Custom timer'
                    : 'Reschedule workout'
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => {
                setSettings(false);
                setModal(null);
              }}
            >
              <X size={21} />
            </button>
            {settings ? (
              <>
                <span className="eyebrow">YOUR PERSONAL SPACE</span>
                <h2>Settings & backup</h2>
                <p className="modal-description">
                  Your history belongs to you. Keep it safe and take it with you.
                </p>
                <CloudAccount
                  user={user}
                  localCount={localCount}
                  addLocal={addLocalHistory}
                  pending={store.pending.length}
                />
                <div className="settings-row">
                  <div>
                    <strong>Timer sound</strong>
                    <p>Repeating alarm until you stop it.</p>
                  </div>
                  <button
                    className={`switch ${!muted ? 'on' : ''}`}
                    role="switch"
                    aria-label="Timer sound"
                    aria-checked={!muted}
                    onClick={toggleMuted}
                  >
                    <span />
                  </button>
                </div>
                <div className="settings-alarm-options">
                  {soundPicker('settings-alarm-sound')}
                  <button
                    className="secondary"
                    onClick={() => (alarmTest ? stopAlarm() : void testAlarm())}
                  >
                    {alarmTest ? <VolumeX size={17} /> : <Volume2 size={17} />}{' '}
                    {alarmTest ? 'Stop test sound' : 'Test sound'}
                  </button>
                </div>
                <div className="settings-buttons">
                  <button className="secondary" onClick={exportData}>
                    <ArrowDownToLine size={17} />
                    Export history
                  </button>
                  <button className="secondary" onClick={() => fileInput.current?.click()}>
                    <Upload size={17} />
                    Import backup
                  </button>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0]) void importData(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
                <p className="settings-help">
                  Importing a backup merges its records with this browser’s and keeps any
                  conflicting edits for review.
                </p>
                <div className="settings-row">
                  <div>
                    <strong>Device sync</strong>
                    <p role="status">{syncStatus}</p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => void sync()}
                    disabled={!user || syncStatus === 'Syncing'}
                  >
                    <Cloud size={16} />
                    Sync now
                  </button>
                </div>
                <p className="settings-help">
                  Offline changes stay on this browser until they sync. Keep this page open for
                  timer cues.
                </p>
                {conflicts.length > 0 && (
                  <div className="conflicts">
                    <h3>{conflicts.length} conflicting edits</h3>
                    <p>Both versions are kept. Choose the result you want to use.</p>
                    {conflicts.map(([entity, versions]) => (
                      <div className="conflict" key={entity}>
                        <strong>{entity}</strong>
                        {versions.map((v) => (
                          <button
                            className="secondary"
                            key={v.id}
                            onClick={() => write(entity, v.data)}
                          >
                            {JSON.stringify(v.data).slice(0, 180)} ·{' '}
                            {new Date(v.at).toLocaleString()}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : modal === 'timer' ? (
              <>
                <span className="eyebrow">TAKE THE TIME YOU NEED</span>
                <h2>Your rest, your pace.</h2>
                <p className="modal-description">
                  Choose any length in minutes and seconds. Set it now, then start when you’re
                  ready.
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    applyCustomTimer();
                  }}
                >
                  <div className="custom-time-fields">
                    <label className="field-label">
                      Minutes
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="999"
                        step="1"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        aria-describedby={customTimerError ? 'custom-time-error' : undefined}
                      />
                    </label>
                    <span aria-hidden="true">:</span>
                    <label className="field-label">
                      Seconds
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="59"
                        step="1"
                        value={customSeconds}
                        onChange={(e) => setCustomSeconds(e.target.value)}
                        aria-describedby={customTimerError ? 'custom-time-error' : undefined}
                      />
                    </label>
                  </div>
                  {customTimerError && (
                    <p className="custom-time-error" role="alert" id="custom-time-error">
                      {customTimerError}
                    </p>
                  )}
                  <button className="primary modal-primary" type="submit">
                    <Timer size={18} />
                    Set timer
                  </button>
                </form>
              </>
            ) : modal === 'finish' ? (
              <>
                <span className="eyebrow">END THIS WORKOUT</span>
                <h2>Finish early.</h2>
                <p className="modal-description">
                  {doneKeys.length} of {allSetKeys.length} sets ticked. Unticked sets are marked
                  skipped and the workout is saved as partial. Ticking every set later still
                  completes it.
                </p>
                <label className="field-label">
                  When did you actually train?
                  <input
                    type="date"
                    value={actualDate}
                    min={days[0].date}
                    max={today}
                    onChange={(e) => setActualDate(e.target.value)}
                  />
                </label>
                <p className="settings-help">
                  Scheduled for {dateLabel(due(day))}. A workout finished after its deadline still
                  counts as activity, just not as on time.
                </p>
                <button className="primary modal-primary" onClick={finishEarly}>
                  <CheckCheck size={18} />
                  Save partial workout
                </button>
              </>
            ) : (
              <>
                <span className="eyebrow">MAKE ROOM FOR LIFE</span>
                <h2>Move this workout.</h2>
                <p className="modal-description">
                  Only this session moves. The original date stays in its history and the rest of
                  your plan stays where it is.
                </p>
                <label className="field-label">
                  New scheduled date
                  <input
                    type="date"
                    value={moveDate}
                    min={today}
                    max={program.end}
                    onChange={(e) => setMoveDate(e.target.value)}
                  />
                </label>
                {moveWorkout(day, map, today, moveDate).lateMove && (
                  <p className="settings-help">
                    This workout was already missed. Moving it keeps the deadline it missed in your
                    consistency history.
                  </p>
                )}
                <button className="primary modal-primary" onClick={reschedule}>
                  <CalendarDays size={18} />
                  Move workout
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function TrendChart({ results }: { results: any[] }) {
  const values = results.map((r) => (r.sides ? Math.min(r.value, r.right) : r.value));
  const max = Math.max(...values, 1) * 1.15;
  const width = 550,
    height = 190;
  const x = (i: number) =>
    results.length === 1 ? width / 2 : 35 + (i / (results.length - 1)) * (width - 70);
  const y = (v: number) => height - 25 - (v / max) * (height - 50);
  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Recorded set performance over time"
      >
        {[0, 0.5, 1].map((p) => (
          <g key={p}>
            <path className="trend-grid" d={`M35 ${y(max * p)}H530`} strokeDasharray="4 5" />
            <text className="trend-label" x="6" y={y(max * p) + 4} fontSize="11">
              {Math.round(max * p)}
            </text>
          </g>
        ))}
        <polyline
          className="trend-line"
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          strokeWidth="2.5"
        />
        {values.map((v, i) => (
          <g key={i}>
            <circle className="trend-point" cx={x(i)} cy={y(v)} r="4" strokeWidth="2">
              <title>
                {dateLabel(results[i].actualDate)}: {v} {results[i].unit}
              </title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="chart-axis">
        <span>{dateLabel(results[0].actualDate)}</span>
        <span>
          {results.length} recorded sets · {results[0].unit}
        </span>
        <span>{dateLabel(results.at(-1).actualDate)}</span>
      </div>
    </div>
  );
}

function ExerciseLogger({
  exercise: e,
  day,
  map,
  previous,
  onSave,
  write,
  notify,
  results,
  onToggle,
  onCheckAll,
}: {
  exercise: Exercise;
  day: Day;
  map: Record<string, Event[]>;
  previous: (e: Exercise, v: string, a: string) => any;
  onSave: (i: number, data: any) => void;
  write: (entity: string, data: any) => void;
  notify: (s: string) => void;
  results: any[];
  onToggle: (i: number) => void;
  onCheckAll: () => void;
}) {
  const defaultVariation = latest(map, `stage:${e.name}`)?.variation || e.variation;
  const firstRecorded = Array.from({ length: e.count }, (_, i) =>
    latest(map, setKey(day.date, e, i)),
  ).find((r) => r && !r.skipped);
  const [sides, setSides] = useState(firstRecorded?.sides ?? e.sides);
  const [variation, setVariation] = useState(firstRecorded?.variation || defaultVariation);
  const [assistance, setAssistance] = useState(firstRecorded?.assistance || '');
  const [technique, setTechnique] = useState(false);
  const [logging, setLogging] = useState(false);
  const [details, setDetails] = useState(false);
  const [advance, setAdvance] = useState(false);
  const [nextVariation, setNextVariation] = useState('');
  const [prompt, setPrompt] = useState<number | null>(null);
  const prior = previous(e, variation, assistance);
  const recorded = Array.from({ length: e.count }, (_, i) => latest(map, setKey(day.date, e, i)));
  const completed = Array.from({ length: e.count }, (_, i) =>
    isSetComplete(map, setKey(day.date, e, i)),
  );
  const allComplete = completed.every(Boolean);
  const grouped =
    (day.sections.find((s) => s.exercises.some((x) => x.id === e.id))?.exercises.length || 0) > 1;
  const canSuggest =
    e.progression &&
    e.top !== null &&
    recorded.every(
      (r, i) =>
        completed[i] &&
        r &&
        !r.skipped &&
        r.clean &&
        r.variation === variation &&
        r.assistance === assistance &&
        r.tempo === e.tempo &&
        r.value >= e.top! &&
        (!sides || r.right >= e.top!),
    );
  if (e.unit === 'check')
    return (
      <button
        className={`checkpoint ${completed[0] ? 'checked' : ''}`}
        role="checkbox"
        aria-checked={completed[0]}
        aria-label={`${e.name} completed`}
        onClick={() => onToggle(0)}
      >
        <span className="checkbox">{completed[0] && <Check size={16} />}</span>
        {completed[0] ? 'Completed' : 'Mark completed'}
      </button>
    );
  return (
    <div className="exercise-logger simple-logger">
      {grouped && (
        <div className="exercise-subheading">
          <h4>{e.name}</h4>
          {e.count > 1 && (
            <button
              className="text-link"
              disabled={allComplete}
              aria-label={`Check all ${e.name} sets`}
              onClick={onCheckAll}
            >
              <CheckCheck size={15} />
              Check all sets
            </button>
          )}
        </div>
      )}
      <div className="quick-sets" data-count={e.count} aria-label={`${e.name} sets`}>
        {Array.from({ length: e.count }, (_, i) => {
          const result = recorded[i];
          const conflict =
            map[setKey(day.date, e, i)]?.length > 1 ||
            map[completionKey(setKey(day.date, e, i))]?.length > 1;
          return (
            <div className={`quick-set-row ${completed[i] ? 'is-complete' : ''}`} key={i}>
              <button
                className="quick-set-check"
                role="checkbox"
                aria-checked={completed[i]}
                aria-label={`${e.name} set ${i + 1} completed`}
                onClick={() =>
                  !completed[i] &&
                  e.unit !== 'check' &&
                  fixedTarget(e) === null &&
                  !(result && !result.skipped)
                    ? setPrompt(i)
                    : onToggle(i)
                }
              >
                <span className="checkbox">{completed[i] && <Check size={16} />}</span>
                <strong>Set {i + 1}</strong>
                <span className="set-target">
                  {e.unit === 'run'
                    ? `${e.target || 'Planned'} mi`
                    : e.target
                      ? `${e.target} ${e.unit}${e.sides ? ' / side' : ''}`
                      : 'As prescribed'}
                </span>
                <span className="completion-copy">
                  {conflict ? 'Review edits' : completed[i] ? 'Completed' : 'Mark complete'}
                </span>
              </button>
              {result && !result.skipped && (
                <button
                  className="saved-result"
                  onClick={() => setLogging(true)}
                  title="View recorded result"
                >
                  {result.value}
                  {result.sides ? ` / ${result.right}` : ''} {e.unit === 'run' ? 'mi' : e.unit}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {prompt !== null && (
        <NumberPrompt
          key={prompt}
          exercise={{ ...e, sides }}
          index={prompt}
          initial={String(prior?.value ?? e.target.split('-')[0])}
          onSave={(value, right) => {
            onSave(prompt, {
              value,
              ...(sides ? { right } : {}),
              sides,
              clean: false,
              variation: variation.trim() || currentVariation(map, e),
              assistance: assistance.trim(),
            });
            setPrompt(null);
          }}
          onSkip={() => {
            onToggle(prompt);
            setPrompt(null);
          }}
          onCancel={() => setPrompt(null)}
        />
      )}
      <button
        className="optional-log-toggle"
        aria-expanded={logging}
        onClick={() => setLogging((v) => !v)}
      >
        {logging ? <ChevronDown size={15} /> : <Plus size={15} />}{' '}
        {logging ? 'Hide result logging' : 'Log results'}
        <span>optional</span>
      </button>
      {logging && (
        <div className="optional-result-panel">
          <div className="optional-result-heading">
            <strong>Your actual results</strong>
            <span>Only these numbers feed performance charts.</span>
          </div>
          {prior && (
            <div className="last-result">
              <TrendingUp size={14} />
              <span>
                Last time:{' '}
                <strong>
                  {prior.value}
                  {prior.sides ? ` / ${prior.right}` : ''} {e.unit === 'run' ? 'mi' : e.unit}
                </strong>{' '}
                · {dateLabel(prior.actualDate)}
              </span>
            </div>
          )}
          <button
            className="setup-toggle"
            aria-expanded={details}
            onClick={() => setDetails((v) => !v)}
          >
            <Settings2 size={14} />
            Change variation or assistance
            <ChevronDown size={13} />
          </button>
          {details && (
            <div className="variation-details">
              <label>
                Exercise variation
                <input
                  maxLength={100}
                  value={variation}
                  onChange={(ev) => setVariation(ev.target.value)}
                  placeholder="e.g. Standard, decline"
                />
              </label>
              <label>
                Assistance / setup
                <input
                  maxLength={100}
                  value={assistance}
                  onChange={(ev) => setAssistance(ev.target.value)}
                  placeholder="e.g. none, band, chair"
                />
              </label>
              <label className="side-choice">
                <input
                  type="checkbox"
                  checked={sides}
                  onChange={(ev) => setSides(ev.target.checked)}
                />
                Record left and right separately
              </label>
            </div>
          )}
          {e.unit !== 'run' && (
            <label className="technique-confirm">
              <input
                type="checkbox"
                checked={technique}
                onChange={(ev) => setTechnique(ev.target.checked)}
              />
              Prescribed technique met (for progression suggestions)
            </label>
          )}
          <div className="sets-table">
            <div className="sets-heading">
              <span>SET</span>
              <span>
                {e.unit === 'run'
                  ? 'MILES / TIME'
                  : sides
                    ? `LEFT / RIGHT · ${e.unit.toUpperCase()}`
                    : e.unit === 'sec'
                      ? 'SECONDS'
                      : 'REPS'}
              </span>
              <span>RESULT</span>
            </div>
            {Array.from({ length: e.count }, (_, i) => (
              <ResultRow
                key={day.date + e.id + i}
                index={i}
                exercise={{ ...e, sides }}
                result={recorded[i]}
                conflict={map[setKey(day.date, e, i)]?.length > 1}
                technique={technique}
                variation={variation}
                assistance={assistance}
                onSave={(data) => onSave(i, { ...data, sides })}
                onSkip={() => write(setKey(day.date, e, i), { skipped: true, day: day.date })}
                notify={notify}
              />
            ))}
          </div>
        </div>
      )}
      {canSuggest && (
        <div className="progression-suggestion">
          <Sparkles size={18} />
          <div>
            <strong>Ready to review the next variation?</strong>
            <p>
              All {e.count} sets reached {e.top} {e.unit}
              {sides ? ' on both sides' : ''} with technique confirmed.
            </p>
            {!advance ? (
              <button className="text-link" onClick={() => setAdvance(true)}>
                Review progression
                <ArrowRight size={15} />
              </button>
            ) : (
              <div className="advance-form">
                <input
                  placeholder="Next variation from your plan"
                  value={nextVariation}
                  onChange={(ev) => setNextVariation(ev.target.value)}
                  maxLength={100}
                />
                <button
                  className="secondary"
                  onClick={() => {
                    if (!nextVariation.trim()) return;
                    write(`stage:${e.name}`, {
                      variation: nextVariation.trim(),
                      previous: variation,
                      evidence: { date: day.date, sets: e.count, target: e.top },
                    });
                    setAdvance(false);
                    notify('Variation saved for future sessions. Past results remain unchanged.');
                  }}
                >
                  Confirm next variation
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({
  index,
  exercise: e,
  result,
  conflict,
  technique,
  variation,
  assistance,
  onSave,
  onSkip,
  notify,
}: {
  index: number;
  exercise: Exercise;
  result: any;
  conflict: boolean;
  technique: boolean;
  variation: string;
  assistance: string;
  onSave: (data: any) => void;
  onSkip: () => void;
  notify: (s: string) => void;
}) {
  const initial = e.target?.split('-')[0] || '';
  const [value, setValue] = useState(String(result?.value ?? initial));
  const [right, setRight] = useState(String(result?.right ?? initial));
  const [minutes, setMinutes] = useState(
    result?.seconds ? String(Math.floor(result.seconds / 60)) : '',
  );
  const [seconds, setSeconds] = useState(result?.seconds ? String(result.seconds % 60) : '');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) {
      setValue(String(result?.value ?? initial));
      setRight(String(result?.right ?? initial));
      if (result?.seconds) {
        setMinutes(String(Math.floor(result.seconds / 60)));
        setSeconds(String(result.seconds % 60));
      }
    }
  }, [result?.value, result?.right, result?.seconds, initial, editing]);
  const done = result && !result.skipped && !editing && !conflict;
  const log = () => {
    const v = Number(value),
      r = Number(right),
      s = Number(minutes) * 60 + Number(seconds),
      timed = Boolean(minutes.trim() || seconds.trim());
    if (
      !value.trim() ||
      !Number.isFinite(v) ||
      v < 0 ||
      v > 100000 ||
      (e.sides && (!right.trim() || !Number.isFinite(r) || r < 0 || r > 100000)) ||
      (e.unit === 'reps' && (!Number.isInteger(v) || (e.sides && !Number.isInteger(r)))) ||
      (e.unit === 'run' &&
        (!(v > 0) ||
          (timed &&
            (!Number.isFinite(s) ||
              !(s > 0) ||
              Number(seconds) >= 60 ||
              Number(seconds) < 0 ||
              Number(minutes) < 0))))
    ) {
      notify('Enter valid results. Runs need a positive distance; reps must be whole numbers.');
      return;
    }
    if (!variation.trim()) {
      notify('Enter the variation you performed.');
      return;
    }
    onSave({
      value: v,
      ...(e.sides ? { right: r } : {}),
      ...(e.unit === 'run' && timed ? { seconds: s } : {}),
      clean: technique,
      variation: variation.trim(),
      assistance: assistance.trim(),
    });
    setEditing(false);
  };
  return (
    <div className={`set-row ${done ? 'logged' : ''} ${result?.skipped ? 'skipped' : ''}`}>
      <span className="set-index">{done ? <Check size={15} /> : index + 1}</span>
      {done ? (
        <span className="logged-value">
          {result.value}
          {e.sides ? ` / ${result.right}` : ''}
          <small>
            {e.unit === 'run'
              ? `mi${result.seconds ? ` · ${formatTime(result.seconds)}` : ''}`
              : e.unit}
            {result.clean ? ' · clean' : ''}
          </small>
        </span>
      ) : (
        <div className="set-inputs">
          <input
            aria-label={`${e.name} set ${index + 1} ${e.sides ? 'left ' : ''}${unitLabel(e.unit)}`}
            type="number"
            min="0"
            max="100000"
            step={e.unit === 'run' ? '0.01' : e.unit === 'reps' ? '1' : '0.1'}
            value={value}
            onChange={(ev) => setValue(ev.target.value)}
            placeholder={e.target || 'Actual'}
          />
          {e.sides && (
            <>
              <span>/</span>
              <input
                aria-label={`${e.name} set ${index + 1} right ${unitLabel(e.unit)}`}
                type="number"
                min="0"
                step={e.unit === 'reps' ? '1' : '0.1'}
                value={right}
                onChange={(ev) => setRight(ev.target.value)}
              />
            </>
          )}
          {e.unit === 'run' && (
            <>
              <span>·</span>
              <input
                aria-label="Run minutes"
                type="number"
                min="0"
                value={minutes}
                onChange={(ev) => setMinutes(ev.target.value)}
                placeholder="min"
              />
              <span>:</span>
              <input
                aria-label="Run seconds"
                type="number"
                min="0"
                max="59"
                value={seconds}
                onChange={(ev) => setSeconds(ev.target.value)}
                placeholder="sec"
              />
            </>
          )}
        </div>
      )}
      <div className="set-actions">
        {done ? (
          <button
            className="edit-set"
            aria-label={`Edit ${e.name} set ${index + 1}`}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        ) : (
          <>
            <button className="log-set" onClick={log}>
              {conflict ? 'Resolve' : 'Save result'}
              <Check size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NumberPrompt({
  exercise: e,
  index,
  initial,
  onSave,
  onSkip,
  onCancel,
}: {
  exercise: Exercise;
  index: number;
  initial: string;
  onSave: (value: number, right: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [right, setRight] = useState(initial);
  const valid = (raw: string) =>
    raw.trim() !== '' &&
    Number.isFinite(Number(raw)) &&
    Number(raw) >= 0 &&
    Number(raw) <= 100000 &&
    (e.unit !== 'reps' || Number.isInteger(Number(raw)));
  const ready = valid(value) && (!e.sides || valid(right));
  return (
    <form
      className="number-prompt"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onSave(Number(value), Number(right));
      }}
    >
      <label>
        Set {index + 1}: how many {unitLabel(e.unit)}
        {e.sides ? ' on each side' : ''}?
        <span className="number-prompt-inputs">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min="0"
            step={e.unit === 'reps' ? '1' : '0.1'}
            aria-label={e.sides ? `Left ${unitLabel(e.unit)}` : unitLabel(e.unit)}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {e.sides && (
            <>
              <span>/</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step={e.unit === 'reps' ? '1' : '0.1'}
                aria-label={`Right ${unitLabel(e.unit)}`}
                value={right}
                onChange={(event) => setRight(event.target.value)}
              />
            </>
          )}
        </span>
      </label>
      <div className="number-prompt-actions">
        <button className="primary" type="submit" disabled={!ready}>
          <Check size={15} />
          Save
        </button>
        <button type="button" className="secondary" onClick={onSkip}>
          Tick without a number
        </button>
        <button type="button" className="text-link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
