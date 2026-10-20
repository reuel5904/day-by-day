import { addDays, completionKey, days, effectiveDate, isSetComplete, latest, mondayOf, resultEntries, setKey, type Day, type Event } from './training-model';

type History=Record<string,Event[]>;
export const isFinished=(status?:string)=>status==='complete'||status==='legacy-complete';

export function completedKeys(day:Day,map:History) {
  return day.blocks.flatMap(block=>block.exercises.flatMap(exercise=>
    Array.from({length:latest(map,`config:${day.date}:${exercise.id}`)?.count||exercise.count},(_,i)=>({key:setKey(day.date,exercise,i),unit:exercise.unit}))
  )).filter(({key})=>isSetComplete(map,key));
}

export function trainingStatus(day:Day,map:History,today:string) {
  if(!day.items.length)return {id:'rest',label:'Planned rest'};
  if(map[`session:${day.date}`]?.length>1)return {id:'conflict',label:'Review conflicting edits'};
  const status=latest(map,`session:${day.date}`)?.status;
  if(status==='complete')return {id:'complete',label:'Complete'};
  if(status==='legacy-complete')return {id:'legacy',label:'Imported completion'};
  if(status==='partial')return {id:'partial',label:'Partial workout'};
  if(completedKeys(day,map).length)return {id:'started',label:'In progress'};
  if(effectiveDate(day,map)<today)return {id:'empty',label:'No workout recorded'};
  return {id:'upcoming',label:effectiveDate(day,map)===today?'Planned for today':'Upcoming workout'};
}

export function calendarDay(date:string,map:History,today:string) {
  const scheduled=days.filter(day=>effectiveDate(day,map)===date);
  const workouts=scheduled.filter(day=>day.items.length);
  const statuses=(workouts.length?workouts:scheduled).map(day=>trainingStatus(day,map,today));
  const finished=statuses.filter(state=>state.id==='complete'||state.id==='legacy').length;
  const status=statuses.find(state=>state.id==='conflict')||
    (finished&&finished===statuses.length?{id:statuses.some(state=>state.id==='legacy')?'legacy':'complete',label:'Complete'}:null)||
    (finished?{id:'partial',label:`${finished} of ${workouts.length} workouts complete`}:null)||
    statuses.find(state=>['partial','started','empty','upcoming'].includes(state.id))||statuses[0]||{id:'off',label:'No session scheduled'};
  const target=workouts.find(day=>!isFinished(latest(map,`session:${day.date}`)?.status))||workouts[0]||scheduled[0];
  return {status,target,workoutCount:workouts.length};
}

export function progressSummary(map:History,today:string) {
  const training=days.filter(day=>day.items.length);
  const finished=training.filter(day=>{const session=latest(map,`session:${day.date}`);return isFinished(session?.status)&&(!session.actualDate||session.actualDate<=today);});
  const activeDates=new Set<string>();let sets=0;
  for(const day of training) {
    const session=latest(map,`session:${day.date}`);
    if(session?.actualDate&&session.actualDate<=today)activeDates.add(session.actualDate);
    for(const {key,unit} of completedKeys(day,map)) {
      const actualDate=latest(map,completionKey(key))?.actualDate||latest(map,key)?.actualDate;
      if(actualDate&&actualDate<=today) {
        activeDates.add(actualDate);
        if(unit!=='check'&&unit!=='run')sets++;
      }
    }
  }
  const measured=resultEntries(map).filter(result=>result.actualDate<=today);
  for(const result of measured)activeDates.add(result.actualDate);
  const weeks=Array.from({length:13},(_,i)=>{
    const start=addDays(mondayOf(days[0].date),i*7),end=addDays(start,6);
    const planned=training.filter(day=>effectiveDate(day,map)>=start&&effectiveDate(day,map)<=end);
    return {start,end,planned:planned.length,completed:planned.filter(day=>finished.includes(day)).length,partial:planned.filter(day=>latest(map,`session:${day.date}`)?.status==='partial').length};
  });
  return {
    completed:finished.length,sets,activeDays:activeDates.size,weeks,
    thisWeek:weeks.find(week=>week.start===mondayOf(today)),
    strength:finished.filter(day=>!day.blocks.some(block=>block.kind==='run')).length,
    runs:finished.filter(day=>day.blocks.some(block=>block.kind==='run')).length,
    partial:training.filter(day=>latest(map,`session:${day.date}`)?.status==='partial').length,
    inProgress:training.filter(day=>trainingStatus(day,map,today).id==='started').length,
    restDays:days.filter(day=>!day.items.length&&effectiveDate(day,map)<=today).length,
    distance:measured.filter(result=>result.unit==='run').reduce((sum,result)=>sum+result.value,0),
    measurements:measured.length,
  };
}
