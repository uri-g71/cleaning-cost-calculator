import {z} from "zod";
import {leaveCosts, FULL_MONTH_HOURS} from "./leave-costs";

export const CALCULATION_VERSION = "2026.10.21-19";
export const NI_MAXIMUM = 51910;
// UI row identifiers are not authentication tokens; support non-secure previews too.
export const uid = () => typeof crypto.randomUUID==="function"?crypto.randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const amount = z.number().finite().min(0).max(100000000);
const hours = amount.max(744);
const tenure = z.number().finite().min(0).max(100).multipleOf(.5);
const week = z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5),z.literal(6)]);
export const jobSchema = z.object({id:z.string().max(100),employees:z.number().int().min(1).max(10000),tenure,workWeek:week,regularHours:hours,hours125:hours,hours150:hours});
const costSchema = z.object({id:z.string().max(100),name:z.string().max(300),monthlyCost:amount});
export const formSchema = z.object({
 clientName:z.string().max(300),siteName:z.string().max(300),quoteDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 baseWage:amount,sectorWage:amount.default(39.11),tenureYears:tenure,workWeek:week,baseMonthlyHours:hours,
 leaveBasis:z.enum(["workbook","actual"]).default("workbook"),
 niThresholdMonthly:amount,niMaximumMonthly:amount.default(NI_MAXIMUM),
 sickRate:amount.max(100),holidayBackToBack:z.boolean(),sickBackToBack:z.boolean(),travelBackToBack:z.boolean(),excellenceBackToBack:z.boolean(),
 holidayGiftAmount:amount.default(0),holidayGiftBackToBack:z.boolean().default(false),
 excellenceInputMode:z.enum(["hourly","monthly"]).default("hourly"),excellenceHourly:amount,excellenceMonthly:amount.default(0),
 monthlyMaterials:amount,monthlyTravel:amount,monthlyOther:amount,otherCostDescription:z.string().max(1000),
 overheadPercent:amount.max(1000),profitPercent:amount.max(1000),vatPercent:amount.max(100),
 jobs:z.array(jobSchema).max(200),siteCosts:z.array(costSchema).max(100),notes:z.string().max(10000),
});
export type FormData = z.infer<typeof formSchema>;
export type Job = z.infer<typeof jobSchema>;
export type SiteCost = z.infer<typeof costSchema>;
export const initial = ():FormData => ({
 clientName:"",siteName:"",quoteDate:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10),
 baseWage:39.11,sectorWage:39.11,tenureYears:0,workWeek:5,baseMonthlyHours:182,leaveBasis:"workbook",
 niThresholdMonthly:7703,niMaximumMonthly:NI_MAXIMUM,sickRate:2.5,
 holidayBackToBack:false,sickBackToBack:false,travelBackToBack:false,excellenceBackToBack:false,
 holidayGiftAmount:300,holidayGiftBackToBack:false,
 excellenceInputMode:"hourly",excellenceHourly:0,excellenceMonthly:0,monthlyMaterials:0,monthlyTravel:0,monthlyOther:0,otherCostDescription:"",
 overheadPercent:8,profitPercent:12,vatPercent:18,jobs:[],
 siteCosts:["מיכון ומכונות","ביגוד וציוד אישי","הסעות / נסיעות","פיקוח וניהול","עלויות נוספות"].map(name=>({id:uid(),name,monthlyCost:0})),notes:"",
});
export function parseForm(value:unknown):FormData {
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("מבנה קובץ ההצעה אינו תקין");
 const raw=value as Record<string,unknown>;
 // One-way migration of the original monthly = hours × rate site-cost fields.
 const costs=Array.isArray(raw.siteCosts)?raw.siteCosts.map(c=>{
  if(!c||typeof c!=="object")return c;
  const x=c as Record<string,unknown>;
  return {...x,monthlyCost:x.monthlyCost??Number(x.hours??0)*Number(x.rate??0)};
 }):undefined;
 // Missing gift fields belong to old proposals: never silently add a new cost.
 const parsed=formSchema.safeParse({...initial(),holidayGiftAmount:0,...raw,...(costs?{siteCosts:costs}:{})});
 if(!parsed.success)throw new Error("נתוני ההצעה אינם תקינים: "+parsed.error.issues.map(x=>x.path.join(".")).slice(0,3).join(", "));
 return parsed.data;
}
export const tenureAdd = (years:number) => years<1?0:years<5?.35:.46;
export function holidayGift(amountPerHoliday:number,monthlyHours:number,backToBack:boolean){
 const factor=monthlyHours<=0?0:monthlyHours>=FULL_MONTH_HOURS/2?1:monthlyHours/FULL_MONTH_HOURS;
 const monthly=amountPerHoliday*2/12*factor;
 return {factor,monthly,hourly:backToBack||monthlyHours<=0?0:monthly/monthlyHours};
}
export function nationalInsurance(gross:number,threshold=7703,maximum=NI_MAXIMUM){
 const capped=Math.min(Math.max(0,gross),maximum),lowBase=Math.min(capped,threshold),highBase=Math.max(0,capped-lowBase);
 return {gross,lowBase,highBase,low:lowBase*.0451,high:highBase*.076,total:lowBase*.0451+highBase*.076};
}
export function hourly(form:FormData,years=form.tenureYears,week:Job["workWeek"]=form.workWeek,monthlyHours=form.baseMonthlyHours,hours125=0,hours150=0){
 const valid=monthlyHours>0,divide=(value:number)=>valid?value/monthlyHours:0;
 const tenure=tenureAdd(years),wage=form.baseWage+tenure;
 const leave=leaveCosts(years,week,wage,monthlyHours,form.leaveBasis);
 const sectorLeave=leaveCosts(years,week,form.sectorWage+tenure,monthlyHours,form.leaveBasis);
 const holidayRate=9*leave.dayHours/(12*FULL_MONTH_HOURS);
 const vacation=leave.vacation,recovery=leave.recovery;
 // Annual planning allowance. Actual holiday eligibility is checked at settlement.
 const holiday=form.holidayBackToBack?0:wage*holidayRate;
 // A commercial assumption, NOT a statutory accrual rate. Do not compound leave reserves.
 const sick=form.sickBackToBack?0:(wage+recovery)*form.sickRate/100;
 const socialBase=form.baseWage+tenure+vacation+holiday+recovery+sick;
 const sectorHoliday=form.holidayBackToBack?0:(form.sectorWage+tenure)*holidayRate;
 const sectorSick=form.sickBackToBack?0:(form.sectorWage+tenure+recovery)*form.sickRate/100;
 const fundBase=form.sectorWage+sectorLeave.vacation+sectorHoliday+recovery+sectorSick;
 const pension=socialBase*.075,comp=socialBase*.0833,fund=fundBase*.075;
 const travel=form.travelBackToBack?0:divide(form.monthlyTravel),travelPension=travel*.05;
 const excellence=form.excellenceBackToBack?0:form.excellenceInputMode==="monthly"?divide(form.excellenceMonthly):form.excellenceHourly;
 const gift=holidayGift(form.holidayGiftAmount,monthlyHours,form.holidayGiftBackToBack);
 const materials=divide(form.monthlyMaterials),other=divide(form.monthlyOther);
 const regularGross=valid?(socialBase+travel+excellence+gift.hourly)*monthlyHours:0;
 const ni=nationalInsurance(regularGross,form.niThresholdMonthly,form.niMaximumMonthly),niLow=divide(ni.low),niHigh=divide(ni.high);
 const labor=socialBase+pension+comp+fund+niLow+niHigh,directBeforeExtras=labor+travel+travelPension+excellence+gift.hourly,direct=directBeforeExtras+materials+other;
 const markup=(cost:number)=>{const overhead=cost*form.overheadPercent/100,profit=(cost+overhead)*form.profitPercent/100;return {cost,overhead,profit,total:cost+overhead+profit}};
 const overtimeExcellence=form.excellenceBackToBack||form.excellenceInputMode==="monthly"?0:form.excellenceHourly;
 const gross125=wage*1.25+overtimeExcellence,gross150=wage*1.5+overtimeExcellence;
 const overtimeGross=gross125*hours125+gross150*hours150;
 const fullNi=nationalInsurance(regularGross+overtimeGross,form.niThresholdMonthly,form.niMaximumMonthly);
 // The lower band is consumed only once per employee/month. Split the incremental
 // contribution proportionally between the two overtime wage pools (order-independent).
 const niRatio=overtimeGross>0?(fullNi.total-ni.total)/overtimeGross:0;
 const overtime=(factor:number,gross:number)=>{
  const marginalNi=overtimeGross>0?gross*niRatio:nationalInsurance(regularGross+gross,form.niThresholdMonthly,form.niMaximumMonthly).total-ni.total;
  return {...markup(wage*factor*(1+.075+.06)+overtimeExcellence+marginalNi),ni:marginalNi};
 };
 const p125=overtime(1.25,gross125),p150=overtime(1.5,gross150),regular=markup(direct);
 return {valid,leave,holidayRate,excellence,gift,vacation,tenure,holiday,recovery,sick,socialBase,fundBase,pension,comp,fund,niLow,niHigh,travel,travelPension,materials,other,labor,directBeforeExtras,direct,regular,p125,p150,regularGross,monthlyNi:fullNi.total,monthlyGross:regularGross+overtimeGross};
}
export function calculate(form:FormData){
 const sample=hourly(form);
 const jobRows=form.jobs.map(j=>{
  const h=hourly(form,j.tenure,j.workWeek,j.regularHours,j.hours125,j.hours150);
  const total=j.regularHours>0?j.employees*(j.regularHours*h.regular.total+j.hours125*h.p125.total+j.hours150*h.p150.total):0;
  return {...j,total,regularPrice:h.regular.total,p125:h.p125.total,p150:h.p150.total,monthlyNi:h.monthlyNi,monthlyGross:h.monthlyGross};
 });
 const work=jobRows.reduce((s,j)=>s+j.total,0),regularSiteHours=jobRows.reduce((s,j)=>s+j.employees*j.regularHours,0);
 const siteDirect=form.siteCosts.reduce((s,c)=>s+c.monthlyCost,0),siteOverhead=siteDirect*form.overheadPercent/100,siteProfit=(siteDirect+siteOverhead)*form.profitPercent/100;
 const beforeVat=work+siteDirect+siteOverhead+siteProfit,vat=beforeVat*form.vatPercent/100;
 const errors:string[]=[];
 if(form.baseMonthlyHours<=0)errors.push("יש להזין כמות שעות גדולה מאפס לחישוב העלות לשעה.");
 if(form.niThresholdMonthly>form.niMaximumMonthly)errors.push("מדרגת הביטוח המופחתת אינה יכולה להיות מעל תקרת החיוב.");
 if(form.jobs.some(j=>j.regularHours<=0))errors.push("יש להזין שעות רגילות גדולות מאפס בכל קבוצת עובדים.");
 if(form.jobs.some(j=>j.employees<1||!Number.isInteger(j.employees)))errors.push("מספר העובדים חייב להיות מספר שלם וחיובי.");
 if(form.jobs.some(j=>j.regularHours+j.hours125+j.hours150>744))errors.push("סך השעות לעובד חורג ממספר השעות בחודש.");
 if(siteDirect>0&&regularSiteHours<=0)errors.push("יש להוסיף שעות כוח אדם לפני חלוקת עלויות האתר.");
 return {sample,totals:{jobRows,work,regularSiteHours,siteDirect,siteOverhead,siteProfit,beforeVat,vat,total:beforeVat+vat},errors};
}
export type Calculation = ReturnType<typeof calculate>;
export type SavedProposal={format:"cleaning-proposal";schemaVersion:2|3;calculationVersion:string;savedAt:string;data:FormData;snapshot:Calculation};
export function makeProposal(form:FormData,snapshot=calculate(form)):SavedProposal{
 const data=parseForm(form);
 if(snapshot.errors.length)throw new Error(snapshot.errors.join(" "));
 return {format:"cleaning-proposal",schemaVersion:3,calculationVersion:CALCULATION_VERSION,savedAt:new Date().toISOString(),data,snapshot};
}
function sameShape(template:unknown,value:unknown):boolean{
 if(typeof template==="number")return typeof value==="number"&&Number.isFinite(value);
 if(Array.isArray(template))return Array.isArray(value)&&template.length===value.length&&template.every((v,i)=>sameShape(v,value[i]));
 if(template&&typeof template==="object")return !!value&&typeof value==="object"&&Object.entries(template).every(([k,v])=>sameShape(v,(value as Record<string,unknown>)[k]));
 return typeof template===typeof value;
}
export function readProposal(value:unknown):{data:FormData;proposal:SavedProposal|null}{
 const raw=value as Partial<SavedProposal>;
 if(raw?.format==="cleaning-proposal"){
  if(![2,3].includes(raw.schemaVersion as number)||typeof raw.calculationVersion!=="string"||typeof raw.savedAt!=="string")throw new Error("גרסת קובץ ההצעה אינה נתמכת");
  const data=parseForm(raw.data),current=calculate(data);
  let snapshot=raw.snapshot;
  // Extend v2 snapshots without recalculating any historical price or contribution.
  if(raw.schemaVersion===2&&snapshot?.sample&&!snapshot.sample.gift&&data.holidayGiftAmount===0){
   snapshot={...snapshot,sample:{...snapshot.sample,gift:holidayGift(0,data.baseMonthlyHours,false)}};
  }
  if(!sameShape(current,snapshot))throw new Error("תוצאות ההצעה השמורה חסרות או לא תקינות");
  return {data,proposal:{...raw,data,snapshot} as SavedProposal};
 }
 return {data:parseForm(value),proposal:null};
}
