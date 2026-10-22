type AlarmNote = {
  offset: number;
  frequency: number;
  duration: number;
  volume: number;
  wave: OscillatorType;
  endFrequency?: number;
};
export type AlarmSoundId = 'classic' | 'chime' | 'bell' | 'pulse';
type AlarmSound = { id: AlarmSoundId; label: string; notes: AlarmNote[] };

// Synthesized locally so every alarm also works offline. Patterns fit the 2.4s repeat interval.
export const ALARM_SOUNDS: AlarmSound[] = [
  {
    id: 'classic',
    label: 'Classic beep',
    notes: [0, 0.26, 0.52, 1.05, 1.31].map((offset, i) => ({
      offset,
      frequency: i % 2 ? 740 : 988,
      duration: 0.22,
      volume: 0.16,
      wave: 'square',
    })),
  },
  {
    id: 'chime',
    label: 'Soft chime',
    notes: [523.25, 659.25, 783.99].map((frequency, i) => ({
      offset: i * 0.28,
      frequency,
      duration: 0.8,
      volume: 0.24,
      wave: 'sine',
    })),
  },
  {
    id: 'bell',
    label: 'Bell',
    notes: [0, 0.8].flatMap((offset) => [
      { offset, frequency: 880, duration: 1.2, volume: 0.24, wave: 'sine' },
      { offset, frequency: 1760, duration: 0.65, volume: 0.08, wave: 'sine' },
      { offset, frequency: 2376, duration: 0.35, volume: 0.04, wave: 'sine' },
    ]),
  },
  {
    id: 'pulse',
    label: 'Digital pulse',
    notes: [0, 0.18, 0.36, 0.9, 1.08, 1.26].map((offset) => ({
      offset,
      frequency: 660,
      endFrequency: 1320,
      duration: 0.13,
      volume: 0.2,
      wave: 'triangle',
    })),
  },
];

export function alarmSound(id: string | null): AlarmSound {
  return ALARM_SOUNDS.find((sound) => sound.id === id) || ALARM_SOUNDS[0];
}
