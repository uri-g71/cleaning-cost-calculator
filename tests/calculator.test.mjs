import assert from "node:assert/strict";
import test,{after} from "node:test";
import {readFile} from "node:fs/promises";
import {createServer} from "vite";
import ExcelJS from "exceljs";
const vite=await createServer({configFile:false,appType:"custom",cacheDir:"node_modules/.vite-test-calculator",server:{middlewareMode:true}});
after(()=>vite.close());
const {initial,calculate,hourly,holidayGift,nationalInsurance,makeProposal,readProposal,parseForm}=await vite.ssrLoadModule("/lib/calculator.ts");
const {buildWorkbook}=await vite.ssrLoadModule("/lib/report.ts");
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const form=(patch={})=>({...initial(),...patch});
const job={id:"test",employees:1,tenure:0,workWeek:5,regularHours:182,hours125:20,hours150:10};
const ni=g=>Math.min(g,7703)*.0451+Math.max(0,Math.min(g,51910)-7703)*.076;

test("all 1–6 work weeks, half years and part/full time: original workbook accrual tables",async()=>{
 let rows;
 if(process.env.SOURCE_WORKBOOK){
  const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(process.env.SOURCE_WORKBOOK);const s=wb.getWorksheet("נתוני עזר");
  const val=a=>{const v=s.getCell(a).value;return typeof v==="object"?v?.result:v;};
  const lookup=(year,key,col,start,end)=>{let result;for(let r=start;r<=end;r++)if(val(key+r)<=year)result=val(col+r);return result;};
  rows=y=>({tenure:lookup(y,"A","B",3,53),five:lookup(y,"D","F",4,54),six:lookup(y,"D","E",4,54),rec:lookup(y,"H","I",3,53)});
 }else{
  const table=[[0,12,14,7],[1,12,14,7],[3,12,14,9],[4,13,15,9],[5,18,20,9],[6,19,21,9],[8,23,26,9],[10,23,26,10],[15,23,26,11],[19,23,26,12],[24,23,26,13]];
  rows=y=>{const r=table.filter(r=>r[0]<=y).at(-1);return{tenure:y<1?0:y<5?.35:.46,five:r[1],six:r[2],rec:r[3]};};
 }
 let checks=0;
 for(let y=0;y<=50;y+=.5)for(let w=1;w<=6;w++)for(const hours of [40,91,182,200]){
  const expected=rows(y),s=hourly(form({tenureYears:y,workWeek:w,baseMonthlyHours:hours}));
  const day=w<=5?8.4:7,days=w<=5?expected.five:expected.six;
  const vacation=(39.11+expected.tenure)*days*day/2184,recovery=512.12*expected.rec/(2184-day*(9+days));
  close(s.tenure,expected.tenure);close(s.leave.vacationDays,days);close(s.leave.recoveryDays,expected.rec);close(s.vacation,vacation);close(s.recovery,recovery);close(s.leave.vacationMonthly,vacation*hours);close(s.leave.recoveryMonthly,recovery*hours);checks+=7;
 }
 assert.equal(checks,16968);
});
test("holiday rate updates on week/tenure alone; 1–5 days use five-day minimum",()=>{
 for(const y of [0,.5,1,4.5,5])for(let w=1;w<=6;w++){
  const s=hourly(form({tenureYears:y,workWeek:w}));close(s.holiday,(39.11+s.tenure)*9*(w<=5?8.4:7)/2184);
 }
 assert.ok(hourly(form({workWeek:6})).holiday<hourly(form({workWeek:5})).holiday);
});
test("fund is based on the sector base, not a higher personal wage",()=>{
 for(const y of [0,1,5,15])for(const w of [5,6]){
  const low=hourly(form({tenureYears:y,workWeek:w})),high=hourly(form({baseWage:80,tenureYears:y,workWeek:w}));close(low.fund,high.fund);assert.ok(high.pension>low.pension);
 }
});
test("both national-insurance bands and the maximum cap",()=>{
 for(const gross of [0,7702.99,7703,7703.01,51909.99,51910,51910.01,1000000])close(nationalInsurance(gross).total,ni(gross));
 close(nationalInsurance(1000000).total,3707.1373);
});
test("overtime uses the monthly bands once, independently of the hour types",()=>{
 for(const wage of [10,39.11,60,300])for(const hours of [40,91,182]){
  const f=form({baseWage:wage,overheadPercent:0,profitPercent:0});const h=hourly(f,0,5,hours,20,10);
  close(h.monthlyNi,ni(h.monthlyGross));
  close((h.niLow+h.niHigh)*hours+h.p125.ni*20+h.p150.ni*10,h.monthlyNi);
 }
});
test("monthly materials, other costs, travel and monthly excellence are not billed again on overtime",()=>{
 const f=form({jobs:[job],overheadPercent:0,profitPercent:0});
 const baseline=calculate(f);
 close(calculate({...f,monthlyMaterials:182}).totals.work-baseline.totals.work,182);
 close(calculate({...f,monthlyOther:364}).totals.work-baseline.totals.work,364);
 const h=hourly({...f,monthlyTravel:364,excellenceInputMode:"monthly",excellenceMonthly:182},0,5,182,20,10);
 close(h.travel*182,364);close(h.excellence*182,182);
 close(h.monthlyGross,baseline.totals.jobRows[0].monthlyGross+546);
});
test("all 32 back-to-back combinations remove only the relevant costs and contributions",()=>{
 for(let mask=0;mask<32;mask++){
  const f=form({holidayBackToBack:!!(mask&1),sickBackToBack:!!(mask&2),travelBackToBack:!!(mask&4),excellenceBackToBack:!!(mask&8),holidayGiftBackToBack:!!(mask&16),monthlyTravel:364,excellenceInputMode:"monthly",excellenceMonthly:182});
  const h=hourly(f);close(h.travel,mask&4?0:2);close(h.travelPension,mask&4?0:.1);close(h.excellence,mask&8?0:1);
  assert.equal(h.holiday===0,!!(mask&1));assert.equal(h.sick===0,!!(mask&2));close(h.pension,h.socialBase*.075);close(h.comp,h.socialBase*.0833);close((h.niLow+h.niHigh)*182,ni(h.regularGross));
  close(h.gift.hourly,mask&16?0:50/182);
 }
});
test("holiday gift follows the requested 91-hour threshold and editable amount",()=>{
 for(const amount of [0,300,450])for(const hours of [0,1,40,90,90.99,91,91.01,182,200]){
  const expected=amount*2/12*(hours>=91?1:hours/182);
  const gift=holidayGift(amount,hours,false);close(gift.monthly,expected);close(gift.hourly,hours?expected/hours:0);
  const back=holidayGift(amount,hours,true);close(back.monthly,expected);close(back.hourly,0);
 }
 close(holidayGift(300,91,false).monthly,50);close(holidayGift(300,90,false).monthly,50*90/182);
});
test("gift is calculated per employee/group and charged once, with NI but no pension",()=>{
 const jobs=[{...job,employees:2,regularHours:90},{...job,id:"half",regularHours:91},{...job,id:"full",regularHours:182}];
 const f=form({jobs,overheadPercent:0,profitPercent:0}),withGift=calculate(f),withoutGift=calculate({...f,holidayGiftAmount:0});
 let expected=0;
 jobs.forEach((j,i)=>{
  const monthly=50*(j.regularHours>=91?1:j.regularHours/182),a=withGift.totals.jobRows[i],b=withoutGift.totals.jobRows[i];
  close(a.monthlyGross-b.monthlyGross,monthly);
  expected+=j.employees*(monthly+ni(a.monthlyGross)-ni(b.monthlyGross));
 });
 close(withGift.totals.work-withoutGift.totals.work,expected);
 for(const key of ["pension","comp","fund","vacation","recovery","holiday","sick"])close(withGift.sample[key],withoutGift.sample[key]);
 const back=calculate({...f,holidayGiftBackToBack:true});close(back.totals.work,withoutGift.totals.work);
});
test("v18 saved snapshot opens without changing any historical amounts",async()=>{
 const old=JSON.parse(await readFile(new URL("./fixtures/proposal-v18.json",import.meta.url),"utf8"));
 const result=readProposal(old);
 assert.equal(result.data.holidayGiftAmount,0);
 const {gift,...sample}=result.proposal.snapshot.sample;assert.deepEqual(sample,old.snapshot.sample);
 assert.deepEqual(result.proposal.snapshot.totals,old.snapshot.totals);close(gift.hourly,0);
 assert.deepEqual(calculate(result.data).totals,old.snapshot.totals);
 const savedAgain=readProposal(JSON.parse(JSON.stringify(result.proposal)));assert.deepEqual(savedAgain.proposal.snapshot,result.proposal.snapshot);
 const legacy={...old.data};assert.equal(readProposal(legacy).data.holidayGiftAmount,0);
});
test("gift inputs, amount and back-to-back status survive proposal and Excel export",async()=>{
 for(const back of [false,true]){
  const f=form({holidayGiftAmount:450,holidayGiftBackToBack:back,baseMonthlyHours:91,jobs:[job]}),c=calculate(f);
  const opened=readProposal(JSON.parse(JSON.stringify(makeProposal(f))));assert.equal(opened.data.holidayGiftAmount,450);assert.equal(opened.data.holidayGiftBackToBack,back);
  const generated=await buildWorkbook(f,c),wb=new ExcelJS.Workbook();await wb.xlsx.load(await generated.xlsx.writeBuffer());
  const ws=wb.worksheets[0],row=ws.getRows(1,ws.rowCount).find(r=>r.getCell(1).value==="שי לחג");
  close(row.getCell(3).result,back?0:75/91);assert.match(row.getCell(4).value,/75.00/);assert.match(row.getCell(4).value,/450.00/);
  if(back)assert.equal(row.getCell(2).result,"גב אל גב");
 }
});
test("site allocation is weighted by employees × regular hours",()=>{
 const c=calculate(form({jobs:[job,{...job,id:"second",employees:2,regularHours:91}],siteCosts:[{id:"machine",name:"מיכון",monthlyCost:728}]}));close(c.totals.regularSiteHours,364);close(c.totals.siteDirect/c.totals.regularSiteHours,2);
});
test("zero hours and invalid imports cannot yield a valid proposal",()=>{
 const f=form({baseMonthlyHours:0,monthlyTravel:364});assert.ok(calculate(f).errors.length);assert.equal(calculate(f).sample.valid,false);assert.throws(()=>makeProposal(f));
 for(const patch of [{baseWage:Infinity},{baseWage:-1},{workWeek:7},{tenureYears:.25},{jobs:[{...job,employees:.5}]}])assert.throws(()=>parseForm({...form(),...patch}));
});
test("new snapshots preserve original totals; legacy imports migrate without losing empty lists",()=>{
 const original=makeProposal(form({clientName:"בדיקה",jobs:[job],notes:"הערות בעברית"}));
 const restored=readProposal(JSON.parse(JSON.stringify(original)));assert.deepEqual(restored.proposal,original);
 original.snapshot.totals.beforeVat=123;close(readProposal(original).proposal.snapshot.totals.beforeVat,123);
 const legacy=readProposal({...form(),siteCosts:[{id:"legacy",name:"מיכון",hours:100,rate:5,monthlyCost:undefined}]});assert.equal(legacy.proposal,null);close(legacy.data.siteCosts[0].monthlyCost,500);
 assert.deepEqual(readProposal({...form(),jobs:[],siteCosts:[]}).data.siteCosts,[]);
 assert.throws(()=>readProposal({...original,snapshot:{}}));
});
test("Excel file opens with the full calculation, B/B terms, cached formula totals and RTL",async()=>{
 const f=form({clientName:"לקוח בדיקה",jobs:[job],monthlyMaterials:182,monthlyTravel:364,excellenceInputMode:"monthly",excellenceMonthly:182,holidayBackToBack:true});const c=calculate(f);
 const wb=await buildWorkbook(f,c),buffer=await wb.xlsx.writeBuffer(),opened=new ExcelJS.Workbook();await opened.xlsx.load(buffer);
 assert.equal(opened.worksheets.length,3);const cost=opened.worksheets[0],site=opened.worksheets[1];assert.ok(cost.views[0].rightToLeft);assert.equal(cost.getCell("B2").value,f.clientName);
 const holiday=cost.getRows(1,cost.rowCount).find(r=>r.getCell(1).value==="חגים");assert.equal(holiday.getCell(3).result,0);assert.match(String(holiday.getCell(4).value),/גב אל גב/);
 const final=site.getRows(1,site.rowCount).find(r=>r.getCell(1).value==="מחיר כולל מע״מ");close(final.getCell(2).result,c.totals.total);assert.ok(final.getCell(2).formula);
 if(process.env.QA_XLSX)await wb.xlsx.writeFile(process.env.QA_XLSX);
});
