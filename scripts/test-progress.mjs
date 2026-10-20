import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['web/src/progress-model.ts'],bundle:true,platform:'node',format:'esm',outfile:'.work/progress-test.mjs'});
await build({entryPoints:['web/src/training-model.ts'],bundle:true,platform:'node',format:'esm',outfile:'.work/progress-training.mjs'});
const {progressSummary,trainingStatus,calendarDay}=await import('../.work/progress-test.mjs');
const {days,heads}=await import('../.work/progress-training.mjs');
const event=(id,entity,data,parents=[])=>({id,entity,data,parents,at:'2026-10-19T12:00:00.000Z'});
let count=0;const test=(name,fn)=>{fn();count++;console.log('✓ '+name);};
const monday=days.find(day=>day.date==='2026-10-19');
const completion=event('set','completion:2026-10-19:b1e0:0',{completed:true,day:monday.date,actualDate:monday.date});
test('Sunday is explicitly planned rest without a check-in or workout credit',()=>{
 const rest=days.find(day=>day.date==='2026-10-18');
 assert.deepEqual(trainingStatus(rest,{},'2026-10-19'),{id:'rest',label:'Planned rest'});
 const summary=progressSummary({},'2026-10-19');assert.equal(summary.restDays,1);assert.equal(summary.completed,0);assert.equal(summary.activeDays,0);assert.equal(summary.thisWeek.planned,6);
});
test('Checkbox-only progress produces stats before Finish without inventing measurements',()=>{
 const map=heads([completion]),summary=progressSummary(map,'2026-10-19');
 assert.equal(summary.sets,1);assert.equal(summary.activeDays,1);assert.equal(summary.inProgress,1);assert.equal(summary.completed,0);assert.equal(summary.measurements,0);assert.equal(summary.distance,0);
 assert.equal(trainingStatus(monday,map,'2026-10-19').id,'started');
});
test('Unchecking removes set credit while retaining an explicitly recorded result',()=>{
 const result=event('result','set:2026-10-19:b1e0:0',{unit:'reps',value:3,actualDate:monday.date,day:monday.date});
 const unchecked=event('uncheck',completion.entity,{...completion.data,completed:false},[completion.id]);
 const summary=progressSummary(heads([completion,result,unchecked]),'2026-10-19');assert.equal(summary.sets,0);assert.equal(summary.activeDays,1);assert.equal(summary.measurements,1);
});
test('Warm-up and run checkboxes count activity but never strength sets or assumed miles',()=>{
 const warmup=event('warmup','completion:2026-10-19:b0e0:0',{completed:true,day:monday.date,actualDate:monday.date});
 const run=event('run','completion:2026-10-20:b1e0:0',{completed:true,day:'2026-10-20',actualDate:'2026-10-19'});
 const summary=progressSummary(heads([warmup,run]),'2026-10-19');assert.equal(summary.sets,0);assert.equal(summary.distance,0);assert.equal(summary.activeDays,1);
});
test('Imported completion counts workouts but cannot invent training dates or completed sets',()=>{
 const summary=progressSummary(heads([event('old','session:2026-10-16',{status:'legacy-complete',actualDate:null})]),'2026-10-19');
 assert.equal(summary.completed,1);assert.equal(summary.activeDays,0);assert.equal(summary.sets,0);assert.equal(summary.measurements,0);
});
test('Weekly totals use revised planned dates and exclude rest; actual days are deduplicated',()=>{
 const session=event('session','session:2026-10-19',{status:'complete',actualDate:'2026-10-19'});
 const moved=event('moved','schedule:2026-10-19',{due:'2026-10-18',originalDate:'2026-10-19',lateMove:false});
 const summary=progressSummary(heads([completion,session,moved]),'2026-10-19');
 assert.equal(summary.activeDays,1);assert.equal(summary.completed,1);assert.equal(summary.strength,1);assert.equal(summary.weeks[0].completed,1);assert.equal(summary.thisWeek.planned,5);assert.equal(summary.thisWeek.completed,0);
});
test('Partial sessions and conflicting set edits do not earn completed workout credit',()=>{
 const conflict=event('other',completion.entity,{...completion.data,completed:false});
 const partial=event('partial','session:2026-10-19',{status:'partial',actualDate:'2026-10-19'});
 const summary=progressSummary(heads([completion,conflict,partial]),'2026-10-19');assert.equal(summary.partial,1);assert.equal(summary.completed,0);assert.equal(summary.sets,0);
});
test('Unrecorded future workouts are upcoming rather than missed',()=>{
 assert.equal(trainingStatus(monday,{},'2026-10-18').id,'upcoming');assert.equal(trainingStatus(monday,{},'2026-10-20').id,'empty');
});
test('A workout moved onto Sunday remains visible and mixed completion is explicit',()=>{
 const move=event('move','schedule:2026-10-19',{due:'2026-10-18',originalDate:'2026-10-19',lateMove:false});
 const cell=calendarDay('2026-10-18',heads([move]),'2026-10-19');assert.equal(cell.status.id,'empty');assert.equal(cell.target.date,'2026-10-19');
 const move2=event('move2','schedule:2026-10-20',{due:'2026-10-18',originalDate:'2026-10-20',lateMove:false});
 const finished=event('finished','session:2026-10-19',{status:'complete',actualDate:'2026-10-18'});
 const mixed=calendarDay('2026-10-18',heads([move,move2,finished]),'2026-10-19');assert.equal(mixed.status.id,'partial');assert.equal(mixed.status.label,'1 of 2 workouts complete');assert.equal(mixed.target.date,'2026-10-20');
});
console.log(`\n${count} progress checks passed.`);
