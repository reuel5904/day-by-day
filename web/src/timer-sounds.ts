type AlarmNote={offset:number;frequency:number;duration:number;volume:number;wave:OscillatorType;endFrequency?:number};
export type AlarmSoundId='classic'|'chime'|'bell'|'pulse';
type AlarmSound={id:AlarmSoundId;label:string;notes:AlarmNote[]};

// Synthesized locally so every alarm also works offline. Patterns fit the 2.4s repeat interval.
export const ALARM_SOUNDS:AlarmSound[]=[
  {id:'classic',label:'Classic beep',notes:[0,.26,.52,1.05,1.31].map((offset,i)=>({offset,frequency:i%2?740:988,duration:.22,volume:.16,wave:'square'}))},
  {id:'chime',label:'Soft chime',notes:[523.25,659.25,783.99].map((frequency,i)=>({offset:i*.28,frequency,duration:.8,volume:.24,wave:'sine'}))},
  {id:'bell',label:'Bell',notes:[0,.8].flatMap(offset=>[
    {offset,frequency:880,duration:1.2,volume:.24,wave:'sine'},
    {offset,frequency:1760,duration:.65,volume:.08,wave:'sine'},
    {offset,frequency:2376,duration:.35,volume:.04,wave:'sine'},
  ])},
  {id:'pulse',label:'Digital pulse',notes:[0,.18,.36,.9,1.08,1.26].map(offset=>({offset,frequency:660,endFrequency:1320,duration:.13,volume:.2,wave:'triangle'}))},
];

export function alarmSound(id:string|null):AlarmSound {
  return ALARM_SOUNDS.find(sound=>sound.id===id)||ALARM_SOUNDS[0];
}
