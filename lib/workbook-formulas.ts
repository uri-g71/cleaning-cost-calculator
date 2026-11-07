import type {Workbook,Worksheet,Cell} from "exceljs";
import {calculate,hourly,nationalInsurance,type FormData,type Calculation} from "./calculator";
import {FULL_MONTH_HOURS,RECOVERY_DAY_VALUE} from "./leave-costs";
import {excelRules,type ExcelRefs,type PriceKey} from "./excel-rules";
import type {RowId,WageRow} from "./report";

type Sample=Calculation["sample"];
const explanations:Record<PriceKey,string>={
 wage:"שכר היסוד לשעה שנקבע בנתוני ההצעה.",vacation:"(שכר יסוד + תוספת ותק) × ימי החופשה לפי הוותק ושבוע העבודה × שעות ליום ÷ בסיס החלוקה לחופשה.",
 tenure:"התוספת לשעה לפי שנות הוותק שהושלמו: לפני שנה, משנה ועד חמש שנים, ומחמש שנים.",holiday:"(שכר יסוד + תוספת ותק) × ימי חג × שעות ליום ÷ שעות משרה מלאה בשנה. בגב אל גב העלות אינה כלולה.",
 recovery:"ערך יום הבראה × ימי ההבראה לפי הוותק ÷ בסיס החלוקה להבראה.",sick:"(שכר יסוד + תוספת ותק + הבראה לשעה) × שיעור אומדן המחלה. בגב אל גב העלות אינה כלולה.",
 travel:"סכום הנסיעות לחודש ÷ שעות רגילות לחודש. בגב אל גב העלות אינה כלולה.",excellence:"במסלול חודשי: המענק לחודש ÷ שעות רגילות לחודש. במסלול שעתי: הסכום שהוזן. בגב אל גב העלות אינה כלולה.",
 gift:"סכום השי לחג × מספר החגים בשנה × שיעור הזכאות ÷ 12 ÷ שעות רגילות לחודש. מחצי משרה הזכאות מלאה; מתחת לכך היא יחסית. בגב אל גב העלות אינה כלולה.",
 niLow:"החלק של השכר החודשי החייב עד המדרגה המופחתת × השיעור המופחת ÷ שעות רגילות לחודש.",niHigh:"החלק של השכר החודשי החייב שמעל המדרגה המופחתת ועד התקרה × השיעור המלא ÷ שעות רגילות לחודש.",
 pension:"סכום שכר היסוד, החופשה, הוותק, החגים, ההבראה והמחלה שנכללו × שיעור הפנסיה בעמודה B.",comp:"סכום שכר היסוד, החופשה, הוותק, החגים, ההבראה והמחלה שנכללו × שיעור הפיצויים בעמודה B.",
 fund:"בסיס השכר הענפי המזכה בקרן השתלמות × השיעור בעמודה B. פירוט הבסיס מופיע בגיליון נתוני חישוב.",travelPension:"עלות הנסיעות לשעה שנכללה בהצעה × שיעור ההפרשה לפנסיה על נסיעות.",
 employer:"סכום רכיבי השכר, ההחזרים, הביטוח הלאומי והפרשות המעסיק המופיעים מעל שורה זו.",materials:"עלות חומרי הניקוי לחודש ÷ שעות רגילות לחודש.",other:"העלות הנוספת לחודש ÷ שעות רגילות לחודש.",
 direct:"עלות המעסיק לשעה + חומרי ניקוי לשעה + העלות הנוספת לשעה.",overhead:"עלות כוללת לפני תקורה × שיעור התקורה בעמודה B.",profit:"(עלות כוללת לפני תקורה + תקורה) × שיעור הרווח בעמודה B.",price:"עלות כוללת לפני תקורה + תקורה + רווח. המחיר לפני מע״מ.",
 p125:"שכר עם ותק × 125%, בתוספת ההפרשות לשעות נוספות, מענק שעתי אם נכלל והביטוח הלאומי הנוסף. על העלות מחושבים תקורה ורווח.",p150:"שכר עם ותק × 150%, בתוספת ההפרשות לשעות נוספות, מענק שעתי אם נכלל והביטוח הלאומי הנוסף. על העלות מחושבים תקורה ורווח.",
};
const abs=(cell:Cell)=>`'${cell.worksheet.name.replaceAll("'","''")}'!${cell.address.replace(/^([A-Z]+)(\d+)$/,(_,col,row)=>`$${col}$${row}`)}`;
const xl=(cell:Cell,expression:string,result:number|string)=>{
 // Elide redundant worksheet names for readability in the formula bar. Both
 // ends of every generated range belong to the same worksheet.
 const prefix=`'${cell.worksheet.name}'!`;
 cell.value={formula:expression.replace(/:'[^']+'!/g,":").replaceAll(prefix,""),result};
};
function samePrices(a:unknown,b:unknown):boolean{
 if(typeof a==="number")return typeof b==="number"&&Math.abs(a-b)<1e-7;
 if(a&&typeof a==="object")return !!b&&typeof b==="object"&&Object.entries(a).every(([k,v])=>samePrices(v,(b as Record<string,unknown>)[k]));
 return a===b;
}

function assumptions(data:Worksheet,f:FormData){
 data.addRow(["נתוני החישוב ונוסחאות קבוצות העובדים"]);data.mergeCells("A1:D1");
 data.addRow(["צפייה בנוסחאות",null,null,"בחרו סכום בעמודת העלות לשעה כדי לראות את הנוסחה בשורת הנוסחאות. תאי החישוב מתעדכנים כשמשנים נתון בקובץ; ההסברים בעמודה D מתארים את ההצעה בעת הייצוא."]);data.getRow(2).height=42;
 data.addRow(["נתון","ערך","יחידה","הסבר"]);
 const p:Record<string,string>={};
 const add=(key:string,label:string,value:number|string,unit:string|null,help?:string)=>{
  const cell=data.addRow([label,value,unit,help||null]).getCell(2);p[key]=abs(cell);
  if(unit==="שיעור")cell.numFmt="0.00%";return cell;
 };
 add("monthlyTravel","נסיעות לחודש",f.monthlyTravel,"₪");add("monthlyMaterials","חומרי ניקוי לחודש",f.monthlyMaterials,"₪");
 add("monthlyOther","עלות נוספת לחודש",f.monthlyOther,"₪",f.otherCostDescription);
 add("excellenceHourly","מענק מצוינות לשעה",f.excellenceHourly,"₪");add("excellenceMonthly","מענק מצוינות לחודש",f.excellenceMonthly,"₪");
 const mode=add("excellenceMode","אופן הזנת מענק מצוינות",f.excellenceInputMode==="monthly"?"חודשי":"שעתי",null);
 mode.dataValidation={type:"list",allowBlank:false,formulae:['"חודשי,שעתי"']};
 add("giftAmount","שי לכל חג",f.holidayGiftAmount,"₪");
 for(const[key,label]of [["holidayBackToBack","חגים"],["sickBackToBack","מחלה"],["travelBackToBack","נסיעות ופנסיה על נסיעות"],["excellenceBackToBack","מענק מצוינות"],["holidayGiftBackToBack","שי לחג"]] as const){
  const cell=add(key,`${label} — גב אל גב`,Number(f[key]),"0 / 1","1 = גב אל גב, מחוץ למחיר. 0 = כלול במחיר.");
  cell.numFmt="0";cell.dataValidation={type:"list",allowBlank:false,formulae:['"0,1"'],showErrorMessage:true,error:"יש לבחור 0 או 1"};
 }
 add("threshold","מדרגה מופחתת בביטוח לאומי",f.niThresholdMonthly,"₪ לחודש");add("maximum","תקרת ביטוח לאומי",f.niMaximumMonthly,"₪ לחודש");
 add("overhead","תקורה",f.overheadPercent/100,"שיעור");add("profit","רווח",f.profitPercent/100,"שיעור");add("vat","מע״מ",f.vatPercent/100,"שיעור");
 add("fullHours","שעות משרה מלאה לחודש",FULL_MONTH_HOURS,"שעות");add("months","חודשים בשנה",12,"חודשים");add("holidays","ימי חג לחישוב",9,"ימים");add("giftCount","מספר שי לחג בשנה",2,"פעמים");
 add("recoveryValue","ערך יום הבראה",RECOVERY_DAY_VALUE,"₪");add("niLow","ביטוח לאומי מופחת",.0451,"שיעור");add("niHigh","ביטוח לאומי מלא",.076,"שיעור");
 add("pension","פנסיה",.075,"שיעור");add("comp","פיצויים בשעות רגילות",.0833,"שיעור");add("fund","קרן השתלמות",.075,"שיעור");add("travelPension","פנסיה על נסיעות",.05,"שיעור");add("otComp","פיצויים בשעות נוספות",.06,"שיעור");
 add("tenureEarly","תוספת ותק לאחר שנה",.35,"₪ לשעה");add("tenureLate","תוספת ותק לאחר חמש שנים",.46,"₪ לשעה");
 return p;
}

function helperValues(f:FormData,s:Sample):Record<keyof ReturnType<typeof excelRules>["helpers"],[string,number]>{
 const regularNi=nationalInsurance(s.regularGross,f.niThresholdMonthly,f.niMaximumMonthly).total;
 const otEx=f.excellenceBackToBack||f.excellenceInputMode==="monthly"?0:f.excellenceHourly;
 const otGross=s.monthlyGross-s.regularGross,sw=f.sectorWage+s.tenure;
 return {
  day:["שעות ליום לצורך זכויות",s.leave.dayHours],vacDays:["ימי חופשה שנתיים",s.leave.vacationDays],recDays:["ימי הבראה שנתיים",s.leave.recoveryDays],annual:["שעות משרה מלאה בשנה",FULL_MONTH_HOURS*12],
  vacDiv:["בסיס חלוקה לחופשה",s.leave.vacationDivisor],recDiv:["בסיס חלוקה להבראה",s.leave.recoveryDivisor],social:["בסיס ההפרשות לשעה",s.socialBase],
  sectorVac:["חופשה לפי שכר ענפי",s.valid?sw*s.leave.vacationDays*s.leave.dayHours/s.leave.vacationDivisor:0],sectorHoliday:["חגים לפי שכר ענפי",f.holidayBackToBack?0:sw*s.holidayRate],sectorSick:["מחלה לפי שכר ענפי",f.sickBackToBack?0:(sw+s.recovery)*f.sickRate/100],
  fundBase:["בסיס קרן השתלמות לשעה",s.fundBase],giftMonthly:["עלות שי לחג לחודש",s.gift.monthly],gross:["שכר חודשי לביטוח לאומי — רגיל",s.regularGross],regularNi:["ביטוח לאומי לחודש — רגיל",regularNi],otEx:["מענק מצוינות בשעה נוספת",otEx],
  wage125:["ברוטו לשעת 125%",(f.baseWage+s.tenure)*1.25+otEx],wage150:["ברוטו לשעת 150%",(f.baseWage+s.tenure)*1.5+otEx],otGross:["ברוטו שעות נוספות לחודש",otGross],fullNi:["ביטוח לאומי לחודש כולל שעות נוספות",s.monthlyNi],niRatio:["יחס ביטוח לאומי לשעות נוספות",otGross>0?(s.monthlyNi-regularNi)/otGross:0],
  ni125:["ביטוח לאומי לשעת 125%",s.p125.ni],cost125:["עלות מעסיק לשעת 125%",s.p125.cost],overhead125:["תקורה לשעת 125%",s.p125.overhead],profit125:["רווח לשעת 125%",s.p125.profit],
  ni150:["ביטוח לאומי לשעת 150%",s.p150.ni],cost150:["עלות מעסיק לשעת 150%",s.p150.cost],overhead150:["תקורה לשעת 150%",s.p150.overhead],profit150:["רווח לשעת 150%",s.p150.profit],
 };
}

export function addWorkbookFormulas(wb:Workbook,ws:Worksheet,groups:Worksheet,f:FormData,calc:Calculation,makeRows:(f:FormData,c:Calculation)=>WageRow[]){
 // Retired rules cannot be inferred from a stored total. Never reprice an old
 // snapshot on Excel open; retain original values and explicitly identify it.
 if(!samePrices(calc,calculate(f))){
  for(const sheet of [ws,groups])sheet.eachRow(row=>row.eachCell(cell=>{if(cell.formula)cell.value=cell.result??null;}));
  ws.addRow(["הצעה היסטורית",null,null,"המחירים נשמרו כפי שהיו בהצעה המקורית. נוסחאות הגרסה ההיסטורית אינן זמינות. לחישוב לפי הנוסחאות הנוכחיות יש לפתוח את ההצעה לעריכה במחשבון."]);return;
 }
 const data=wb.addWorksheet("נתוני חישוב",{views:[{rightToLeft:true,showGridLines:false}]});
 data.columns=[{width:34},{width:17},{width:20},{width:88}];const p=assumptions(data,f);
 const main=(a:string)=>abs(ws.getCell(a));
 const common={p,base:main("B4"),sector:main("D4"),basis:main("B7"),sickRate:main("D7")};
 const title=(label:string)=>{data.addRow([]);const r=data.addRow([label]);data.mergeCells(`A${r.number}:D${r.number}`);};
 function attach(sheet:Worksheet,start:number,rows:WageRow[],s:Sample,scope:Pick<ExcelRefs,"years"|"week"|"hours"|"hours125"|"hours150">,label:string){
  const keys:PriceKey[]=[...rows.map(x=>x[4]),"p125","p150"];
  const c=Object.fromEntries(keys.map((id,i)=>[id,abs(sheet.getCell(`C${start+i}`))])) as Record<PriceKey,string>;
  const b=Object.fromEntries(keys.map((id,i)=>[id,abs(sheet.getCell(`B${start+i}`))])) as Record<PriceKey,string>;
  title(label);
  const evidence=helperValues(f,s),helpers=Object.entries(evidence).map(([key,[name,value]])=>({key:key as keyof typeof evidence,cell:data.addRow([name,null,value]).getCell(3),value}));
  const h=Object.fromEntries(helpers.map(x=>[x.key,abs(x.cell)]));
  const rule=excelRules({...common,c,b,h,...scope});
  helpers.forEach(x=>xl(x.cell,rule.helpers[x.key],x.value));
  const labels:Partial<Record<RowId,boolean>>={holiday:f.holidayBackToBack,sick:f.sickBackToBack,travel:f.travelBackToBack,travelPension:f.travelBackToBack,excellence:f.excellenceBackToBack,gift:f.holidayGiftBackToBack};
  const fixed:Partial<Record<RowId,number>>={wage:1,holiday:s.holidayRate,sick:f.sickRate/100,niLow:.0451,niHigh:.076,pension:.075,comp:.0833,fund:.075,travelPension:.05,overhead:f.overheadPercent/100,profit:f.profitPercent/100};
  rows.forEach(([,value,,,id],i)=>{
   const r=start+i,b=sheet.getCell(`B${r}`),cell=sheet.getCell(`C${r}`);
   xl(cell,rule.costs[id],value);
   if(rule.rates[id]){xl(b,rule.rates[id]!,labels[id]?"גב אל גב":fixed[id]??(f.baseWage?value/f.baseWage:0));b.numFmt="0.00%";}
  });
  xl(sheet.getCell(`C${start+rows.length}`),rule.costs.p125,s.p125.total);xl(sheet.getCell(`C${start+rows.length+1}`),rule.costs.p150,s.p150.total);
  if(sheet===ws)keys.forEach((key,i)=>{sheet.getCell(`C${start+i}`).note=explanations[key];});
  return c;
 }
 attach(ws,9,makeRows(f,calc),calc.sample,{years:main("B5"),week:main("D5"),hours:main("B6"),hours125:"0",hours150:"0"},"פרטי חישוב — סעיף 1");
 calc.totals.jobRows.forEach((j,i)=>{
  const r=i+3,g=(col:string)=>abs(groups.getCell(`${col}${r}`));
  const s=hourly(f,j.tenure,j.workWeek,j.regularHours,j.hours125,j.hours150);
  const rows=makeRows({...f,tenureYears:j.tenure,workWeek:j.workWeek,baseMonthlyHours:j.regularHours},{...calc,sample:s});
  title(`פירוט תעריפים — קבוצת עובדים ${i+1}`);
  const about=data.addRow(["וותק",null,"ימי עבודה"]);xl(about.getCell(2),g("B"),j.tenure);xl(about.getCell(4),g("C"),j.workWeek);
  const hours=data.addRow(["שעות רגילות",null,"מספר עובדים"]);xl(hours.getCell(2),g("D"),j.regularHours);xl(hours.getCell(4),g("A"),j.employees);
  data.addRow(["רכיב","שיעור","עלות לשעה","הסבר / אופן החישוב"]);const first=data.rowCount+1;
  rows.forEach(([name,value,help,rate])=>{data.addRow([name,rate||null,value,help]).height=58;});
  data.addRow(["מחיר שעת 125%",null,s.p125.total]);data.addRow(["מחיר שעת 150%",null,s.p150.total]);
  const prices=attach(data,first,rows,s,{years:g("B"),week:g("C"),hours:g("D"),hours125:g("E"),hours150:g("F")},`פרטי חישוב — קבוצת עובדים ${i+1}`);
  xl(groups.getCell(`G${r}`),prices.price,j.regularPrice);xl(groups.getCell(`H${r}`),prices.p125,j.p125);xl(groups.getCell(`I${r}`),prices.p150,j.p150);
  xl(groups.getCell(`J${r}`),`IF(D${r}>0,A${r}*(D${r}*G${r}+E${r}*H${r}+F${r}*I${r}),0)`,j.total);
 });
 const hoursRow=calc.totals.jobRows.length+4,siteEnd=hoursRow+1+f.siteCosts.length;
 f.siteCosts.forEach((_,i)=>xl(groups.getCell(`D${hoursRow+2+i}`),`$B$${hoursRow}`,calc.totals.regularSiteHours));
 xl(groups.getCell(`C${siteEnd+2}`),p.overhead,f.overheadPercent/100);xl(groups.getCell(`C${siteEnd+3}`),p.profit,f.profitPercent/100);xl(groups.getCell(`C${siteEnd+5}`),p.vat,f.vatPercent/100);
 xl(ws.getCell("D6"),`${p.threshold}&" / "&${p.maximum}`,`${f.niThresholdMonthly} / ${f.niMaximumMonthly}`);
 ws.addRow(["צפייה בנוסחאות",null,null,"לחצו על סכום בעמודה C להצגת הנוסחה. במעבר עם העכבר על התא יוצג גם הסבר בעברית. בגיליון ״נתוני חישוב״ תמצאו את ההנחות ואת פירוט תעריפי הקבוצות."]);
}
