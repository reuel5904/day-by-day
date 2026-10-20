import { days, type Event } from './training-model';

type BrowserStorage = Pick<Storage,'getItem'|'setItem'>;
// The old key is intentionally retained as a second, untouched copy.
export function migrateLegacyHistory(storage:BrowserStorage):number {
  if(storage.getItem('day-by-day-v2:local'))return 0;
  const raw=storage.getItem('day-by-day-v1');
  if(!raw)return 0;
  const old=JSON.parse(raw);
  if(!old||typeof old!=='object'||Array.isArray(old))return 0;
  const events:Event[]=[];const at=new Date().toISOString();
  const add=(date:string,kind:string,data:unknown)=>events.push({id:`legacy-v1-${kind}-${date}`,entity:`${kind}:${date}`,parents:[],data,at});
  for(const day of days){
    const record=old[day.date];if(!record||typeof record!=='object')continue;
    const checks=day.items.map((_,i)=>record.checks?.[i]===true);
    add(day.date,'legacy',{checks,complete:record.complete===true,originalNotes:typeof record.notes==='string'?record.notes:''});
    if(typeof record.notes==='string')add(day.date,'notes',{text:record.notes.slice(0,10000)});
    const complete=day.items.length?checks.every(Boolean):record.complete===true;
    if(complete)add(day.date,'session',{status:'legacy-complete',actualDate:null,source:'v1'});
  }
  if(events.length)storage.setItem('day-by-day-v2:local',JSON.stringify({events,pending:[]}));
  return events.length;
}
