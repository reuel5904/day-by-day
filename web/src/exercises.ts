// Every program names its exercises from this list, so an exercise keeps one history across
// programs. Easier and harder versions are variations of an entry, not new entries.
export const EXERCISES = [
  'Pull-Ups',
  'Chin-Ups',
  'Negative Pull-Ups',
  'Push-Ups',
  'Diamond Push-Ups',
  'Pike Push-Ups',
  'Bulgarian Split Squats',
  'Glute Bridge',
  'Pistol Squat',
  'Hollow Hold',
  'L-Sit',
  'Side Plank',
  'Dead Bug',
  'Calf Raises',
  'Dead Hang',
  'Run',
  'Strides',
  'Warm-up',
  'Cool-down',
  'Mobility 10 min',
] as const;
export type ExerciseName = (typeof EXERCISES)[number];
