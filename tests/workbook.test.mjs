import assert from "node:assert/strict";
import test,{after} from "node:test";
import {readFile,writeFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {createServer} from "vite";
import ExcelJS from "exceljs";
const vite=await createServer({configFile:false,appType:"custom",cacheDir:"node_modules/.vite-test-xlsx",server:{middlewareMode:true,ws:false}});
after(()=>vite.close());
const {initial,calculate,readProposal}=await vite.ssrLoadModule("/lib/calculator.ts");
const {buildWorkbook,allReportRows}=await vite.ssrLoadModule("/lib/report.ts");
const j={id:"first",employees:2,tenure:3.5,workWeek:6,regularHours:91,hours125:20,hours150:10};
const f={...initial(),clientName:"לקוח לדוגמה",siteName:"אתר לדוגמה",baseWage:55,tenureYears:4.5,monthlyTravel:364,monthlyMaterials:182,monthlyOther:91,otherCostDescription:"ציוד מתכלה",excellenceInputMode:"monthly",excellenceMonthly:182,jobs:[j,{...j,id:"second",employees:3,tenure:8,workWeek:5,regularHours:182,hours125:0,hours150:0}],siteCosts:[{id:"machine",name:"מיכון",monthlyCost:728}]};
const close=(a,b,label="")=>assert.ok(typeof a==="number"&&Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
const bytes=async(data,calc=calculate(data))=>Buffer.from(await(await buildWorkbook(data,calc)).xlsx.writeBuffer());
const read=async(buffer)=>{const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer);return wb;};
test("exported native hourly formulas, readable borders and B/C centering survive reopening",async()=>{
 const buf=await bytes(f),wb=await read(buf),cost=wb.worksheets[0],site=wb.worksheets[1],c=calculate(f);
 for(const sheet of wb.worksheets){assert.ok(sheet.views[0].rightToLeft);sheet.eachRow(row=>row.eachCell(cell=>{
  if(cell.isMerged)return;
  if([2,3].includes(cell.col))assert.equal(cell.alignment.horizontal,"center");
  for(const edge of ["top","bottom","left","right"])assert.equal(cell.border[edge]?.style,"thin",`${sheet.name}!${cell.address}`);
 }));}
 allReportRows(f,c).forEach(([,value,,,id],i)=>{const cell=cost.getCell(`C${9+i}`);assert.match(cell.formula,/[A-Z]+\$?\d+/,id);assert.match(JSON.stringify(cell.note),/[א-ת]/,id);close(cell.result,value,id);});
 for(const [cell,expected] of [[cost.getCell("C31"),c.sample.p125.total],[cost.getCell("C32"),c.sample.p150.total],[site.getCell("G4"),c.totals.jobRows[1].regularPrice]]){assert.ok(cell.formula);close(cell.result,expected);}
 if(process.env.XLSX_SAMPLE_PATH)await writeFile(process.env.XLSX_SAMPLE_PATH,buf);
});
test("compatible saved quotes get live formulas; retired rules preserve their original quoted amounts",async()=>{
 const old=readProposal(JSON.parse(await readFile(new URL("./fixtures/proposal-v18.json",import.meta.url),"utf8")));
 const original=old.proposal.snapshot,ws=(await read(await bytes(old.data,original))).worksheets[0];assert.ok(ws.getCell("C30").formula);close(ws.getCell("C30").result,original.sample.regular.total);
 const retired=structuredClone(original);retired.sample.vacation+=.1234;
 const historical=(await read(await bytes(old.data,retired))).worksheets[0];close(historical.getCell("C10").value,retired.sample.vacation);assert.equal(historical.getCell("C10").formula,undefined);assert.match(historical.lastRow.getCell(4).value,/המחירים נשמרו/);
});

// Optional release check: execute the actual exported formulas in an independent
// spreadsheet engine after edits, so correct cached values cannot mask a bad formula.
test("saved XLSX recalculates to the website prices across 50 input scenarios",{skip:!process.env.VERIFY_XLSX_RECALC},async()=>{
 const require=createRequire(import.meta.url),path=require.resolve("@oai/artifact-tool",{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]});
 const {SpreadsheetFile}=await import(pathToFileURL(path).href);
 const workbook=await SpreadsheetFile.importXlsx(new Uint8Array(await bytes(f)));
 const cost=workbook.worksheets.getItem("מחשבון עלות"),site=workbook.worksheets.getItem("כוח אדם ועלויות אתר"),params=workbook.worksheets.getItem("נתוני חישוב");
 const cases=[f];for(let m=0;m<32;m++)cases.push({...f,holidayBackToBack:!!(m&1),sickBackToBack:!!(m&2),travelBackToBack:!!(m&4),excellenceBackToBack:!!(m&8),holidayGiftBackToBack:!!(m&16)});
 for(let w=1;w<=6;w++)cases.push({...f,workWeek:w,tenureYears:w-.5,jobs:f.jobs.map(j=>({...j,workWeek:w,tenure:w-.5}))});
 for(const h of [0,40,90.99,91,182])cases.push({...f,baseMonthlyHours:h,jobs:f.jobs.map(j=>({...j,regularHours:h}))});
 for(const w of [0,10,39.11,300])cases.push({...f,baseWage:w});
 cases.push({...f,leaveBasis:"actual",excellenceInputMode:"hourly",excellenceHourly:2.75,tenureYears:24,jobs:f.jobs.map(j=>({...j,tenure:24}))});
 cases.push({...f,holidayGiftAmount:450,niThresholdMonthly:9000,niMaximumMonthly:45000,profitPercent:20,overheadPercent:5,vatPercent:0});
 const set=(sheet,addr,v)=>{sheet.getRange(addr).values=[[v]];};
 const get=(sheet,addr)=>sheet.getRange(addr).values[0][0];
 for(const [i,q] of cases.entries()){
  for(const [addr,value] of Object.entries({B4:q.baseWage,D4:q.sectorWage,B5:q.tenureYears,D5:q.workWeek,B6:q.baseMonthlyHours,B7:q.leaveBasis==="actual"?"שעות עבודה בפועל":"קובץ האקסל שהועלה",D7:q.sickRate/100}))set(cost,addr,value);
  const inputs=[q.monthlyTravel,q.monthlyMaterials,q.monthlyOther,q.excellenceHourly,q.excellenceMonthly,q.excellenceInputMode==="monthly"?"חודשי":"שעתי",q.holidayGiftAmount,...[q.holidayBackToBack,q.sickBackToBack,q.travelBackToBack,q.excellenceBackToBack,q.holidayGiftBackToBack].map(Number),q.niThresholdMonthly,q.niMaximumMonthly,q.overheadPercent/100,q.profitPercent/100,q.vatPercent/100];
  params.getRange("B4:B20").values=inputs.map(x=>[x]);
  site.getRange("A3:F4").values=q.jobs.map(j=>[j.employees,j.tenure,j.workWeek,j.regularHours,j.hours125,j.hours150]);
  workbook.recalculate();const c=calculate(q);
  const expected=[...allReportRows(q,c).map(row=>row[1]),c.sample.p125.total,c.sample.p150.total];
  const actual=cost.getRange("C9:C32").values;expected.forEach((v,r)=>close(actual[r][0],v,`case ${i} C${r+9}`));
  c.totals.jobRows.forEach((job,n)=>[job.regularPrice,job.p125,job.p150,job.total].forEach((v,k)=>close(get(site,`${"GHIJ"[k]}${n+3}`),v,`case ${i} group ${n}`)));
  close(get(site,"B14"),c.totals.total,`case ${i} final price`);
 }
 assert.equal(cases.length,50);
});
