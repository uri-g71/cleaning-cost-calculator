import type {FormData,Calculation} from "./calculator";
import {CALCULATION_VERSION} from "./calculator";
import {RECOVERY_DAY_VALUE} from "./leave-costs";
export const money=(x:number)=>new Intl.NumberFormat("he-IL",{style:"currency",currency:"ILS",minimumFractionDigits:2}).format(Number.isFinite(x)?x:0);
export const percent=(value:number,base:number)=>`${(base?value/base*100:0).toFixed(2)}%`;
export type RowId="wage"|"vacation"|"tenure"|"holiday"|"recovery"|"sick"|"travel"|"excellence"|"gift"|"niLow"|"niHigh"|"pension"|"comp"|"fund"|"travelPension"|"employer"|"materials"|"other"|"direct"|"overhead"|"profit"|"price";
export type WageRow=[string,number,string,string,RowId];
export function wageRows(form:FormData,sample:Calculation["sample"]):WageRow[]{
 const pct=(x:number)=>percent(x,form.baseWage);
 const rows:[string,number,string,string][] = [
  ["שכר יסוד",form.baseWage,"השכר השעתי ברוטו לעובד.","100.00%"],
  ["חופשה",sample.vacation,`${sample.leave.vacationDays} ימי חופשה לפי שנות הוותק שהושלמו. 1–5 ימי עבודה משתמשים בטבלת 5 ימים; 6 ימים בטבלה הנפרדת. עלות חודשית: ${money(sample.leave.vacationMonthly)}.`,pct(sample.vacation)],
  ["תוספת ותק",sample.tenure,"0.35 ₪ לאחר שנת ותק; 0.46 ₪ לאחר חמש שנות ותק. חצי שנה אינה מקדימה את מדרגת השנה הבאה.",pct(sample.tenure)],
  ["חגים",sample.holiday,form.holidayBackToBack?"גב אל גב: הלקוח יחויב בנפרד בדמי חג לפי הזכאות והביצוע, כולל ההפרשות ועלות הביטוח הלאומי הנלווית. אינם כלולים בסכום ההצעה.":"אומדן שנתי ל־9 ימי חג; התעריף מותאם ל־5 או 6 ימי עבודה וכולל ותק בבסיס. התשלום בפועל כפוף לזכאות, לרבות 3 חודשי ותק וימי החג המזכים.",`${(sample.holidayRate*100).toFixed(2)}%`],
  ["הבראה",sample.recovery,`${sample.leave.recoveryDays} ימי הבראה לפי הוותק; ערך יום ${money(RECOVERY_DAY_VALUE)}. עלות חודשית: ${money(sample.leave.recoveryMonthly)}. בסיס הנוסחה מוצג בהנחות החישוב. אין תוספת הבראה לשעות נוספות.`,pct(sample.recovery)],
  ["מחלה",sample.sick,form.sickBackToBack?"גב אל גב: החיוב הנפרד יהיה לפי דמי המחלה ששולמו בפועל והזכאות, כולל ההפרשות, ההבראה והביטוח הלאומי. אינו כלול בסכום ההצעה.":`אומדן תמחורי של ${form.sickRate}% מהשכר בתוספת ותק והבראה. אינו שיעור צבירת מחלה על פי דין ואינו חישוב תלוש. ניתן לשנותו בהנחות החישוב.`,`${form.sickRate.toFixed(2)}%`],
  ["ביטוח לאומי – שיעור מופחת",sample.niLow,`4.51% עד ${money(form.niThresholdMonthly)} לחודש לעובד. הבסיס כולל את רכיבי השכר, נסיעות, מענק ושי לחג שנכללו בתמחור.`,"4.51%"],
  ["ביטוח לאומי – שיעור מלא",sample.niHigh,`7.6% מעל המדרגה המופחתת ועד ${money(form.niMaximumMonthly)} לחודש. בקבוצות העובדים המדרגות מחושבות פעם אחת על השכר המצטבר, כולל השעות הנוספות.`,"7.60%"],
  ["פנסיה",sample.pension,`7.5% מבסיס מזכה של ${money(sample.socialBase)} לשעה. בשעות נוספות: 7.5% מהגמול המוגדל.`,"7.50%"],
  ["פיצויים",sample.comp,`8.33% מבסיס מזכה של ${money(sample.socialBase)} לשעה. בשעות 125% ו־150%: 6% מהגמול המוגדל.`,"8.33%"],
  ["קרן השתלמות",sample.fund,`7.5% מבסיס ענפי של ${money(sample.fundBase)} לשעה, לפי שכר בסיס ענפי ${money(form.sectorWage)} והתוספות המזכות; לא מכל שכר אישי גבוה יותר. אין הפרשה על שעות נוספות.`,"7.50%"],
 ];
 const ids:RowId[]=["wage","vacation","tenure","holiday","recovery","sick","niLow","niHigh","pension","comp","fund"];
 return rows.map((row,i)=>[...row,ids[i]]);
}
export function allReportRows(form:FormData,c:Calculation):WageRow[]{
 const rows=wageRows(form,c.sample),h=c.sample,pct=(v:number)=>percent(v,form.baseWage);
 return [...rows.slice(0,6),
  ["נסיעות",h.travel,`סכום חודשי: ${money(form.monthlyTravel)}. ${form.travelBackToBack?"גב אל גב, כולל פנסיה על נסיעות וביטוח לאומי בחיוב הנפרד.":"הסכום החודשי מחולק בשעות הרגילות; אינו מחויב שוב בשעות נוספות."}`,form.travelBackToBack?"גב אל גב":pct(h.travel),"travel"],
  ["מענק מצוינות",h.excellence,`${form.excellenceInputMode==="monthly"?`סכום חודשי: ${money(form.excellenceMonthly)}`:`סכום לשעה: ${money(form.excellenceHourly)}`}. ${form.excellenceBackToBack?"גב אל גב, כולל ביטוח לאומי בחיוב הנפרד.":"כלול בבסיס הביטוח הלאומי."}`,form.excellenceBackToBack?"גב אל גב":pct(h.excellence),"excellence"],
  ["שי לחג",h.gift.hourly,`${money(form.holidayGiftAmount)} לכל חג, פעמיים בשנה. מ־91 שעות חודשיות שי מלא; מתחת לכך לפי שעות ÷ 182. עלות חודשית לעובד: ${money(h.gift.monthly)}. ${form.holidayGiftBackToBack?"גב אל גב: השי והביטוח הלאומי הנלווה יחויבו בנפרד ואינם כלולים במחיר.":"כלול בבסיס הביטוח הלאומי, ללא פנסיה, פיצויים או השתלמות. מחולק בשעות הרגילות בלבד."}`,form.holidayGiftBackToBack?"גב אל גב":pct(h.gift.hourly),"gift"],
  ...rows.slice(6),
  ["הפרשה לפנסיה על נסיעות",h.travelPension,form.travelBackToBack?"גב אל גב — מקושר לנסיעות.":"5% מהחזר הנסיעות.","5.00%","travelPension"],
  ["עלות מעסיק לשעת עבודה",h.directBeforeExtras,"לפני חומרים ועלויות נוספות.","","employer"],
  ["חומרי ניקוי",h.materials,`עלות חודשית: ${money(form.monthlyMaterials)}. מחולקת בשעות הרגילות בלבד.`,pct(h.materials),"materials"],
  [form.otherCostDescription||"עלות נוספת",h.other,`עלות חודשית: ${money(form.monthlyOther)}. מחולקת בשעות הרגילות בלבד.`,pct(h.other),"other"],
  ["עלות כוללת לפני תקורה",h.direct,"כולל חומרים והעלות הנוספת.","","direct"],
  ["תקורה",h.regular.overhead,"אחוז מהעלות הישירה.",`${form.overheadPercent}%`,"overhead"],
  ["רווח",h.regular.profit,"תוספת על העלות כולל תקורה (לא שיעור רווח מתוך מחיר המכירה).",`${form.profitPercent}%`,"profit"],
  ["מחיר מכירה לשעה רגילה",h.regular.total,"כולל תקורה ורווח, לפני מע״מ.","","price"],
 ];
}
export async function buildWorkbook(form:FormData,c:Calculation,version=CALCULATION_VERSION){
 const {default:ExcelJS}=await import("exceljs");
 const {addWorkbookFormulas}=await import("./workbook-formulas");
 const wb=new ExcelJS.Workbook();wb.creator="מחשבון תמחיר שירותי ניקיון";wb.created=new Date();
 const ws=wb.addWorksheet("מחשבון עלות",{views:[{rightToLeft:true,showGridLines:false}]});
 ws.columns=[{width:34},{width:17},{width:20},{width:88}];
 ws.addRow(["הצעת מחיר — תמחיר שירותי ניקיון"]);ws.mergeCells("A1:D1");
 ws.addRow(["שם לקוח",form.clientName,"אתר",form.siteName]);
 ws.addRow(["תאריך הצעת מחיר",form.quoteDate,"גרסת חישוב",version]);
 ws.addRow(["שכר יסוד",form.baseWage,"שכר בסיס ענפי",form.sectorWage]);
 ws.addRow(["וותק בשנים",form.tenureYears,"ימי עבודה",form.workWeek]);
 ws.addRow(["שעות רגילות לחודש",form.baseMonthlyHours,"מדרגה / תקרת ב״ל",`${form.niThresholdMonthly} / ${form.niMaximumMonthly}`]);
 ws.addRow(["בסיס חופשה והבראה",form.leaveBasis==="workbook"?"קובץ האקסל שהועלה":"שעות עבודה בפועל", "אומדן מחלה",form.sickRate/100]);ws.getCell("D7").numFmt="0.00%";
 ws.addRow(["רכיב","שיעור","עלות לשעה","הסבר / אופן החישוב"]);
  allReportRows(form,c).forEach(([name,value,help,rate,id])=>ws.addRow([name,(id==="holiday"&&form.holidayBackToBack)||(id==="sick"&&form.sickBackToBack)?"גב אל גב":rate,value,help]));
 ws.addRow(["מחיר שעת 125%","",c.sample.p125.total,"מחיר שולי לאחר השעות הרגילות; ללא חיוב חוזר של עלויות חודשיות."]);
 ws.addRow(["מחיר שעת 150%","",c.sample.p150.total,"בתמחור קבוצה ביטוח לאומי מחושב על סך השכר, ולא בנפרד לכל סוג שעה."]);
 const groups=wb.addWorksheet("כוח אדם ועלויות אתר",{views:[{rightToLeft:true,showGridLines:false}]});
 groups.columns=[{width:30},{width:14},{width:16},{width:18},{width:18},{width:18},{width:22},{width:22},{width:22},{width:22}];
 groups.addRow(["ריכוז כוח האדם באתר",form.clientName]);
 groups.addRow(["עובדים","וותק","ימי עבודה","שעות רגילות לעובד","שעות 125% לעובד","שעות 150% לעובד","תעריף רגיל","תעריף 125%","תעריף 150%","מחיר חודשי"]);
 c.totals.jobRows.forEach(j=>{const r=groups.rowCount+1;groups.addRow([j.employees,j.tenure,j.workWeek,j.regularHours,j.hours125,j.hours150,j.regularPrice,j.p125,j.p150,{formula:`A${r}*(D${r}*G${r}+E${r}*H${r}+F${r}*I${r})`,result:j.total}]);});
 const workEnd=groups.rowCount,workRow=workEnd+1;
 groups.addRow(["עבודה חודשית",{formula:workEnd>=3?`SUM(J3:J${workEnd})`:"0",result:c.totals.work}]);
 groups.addRow(["סך שעות רגילות באתר",{formula:workEnd>=3?`SUMPRODUCT(A3:A${workEnd},D3:D${workEnd})`:"0",result:c.totals.regularSiteHours}]);
 const hoursRow=groups.rowCount;
 groups.addRow(["סעיף","עלות חודשית","עלות לשעה","בסיס החלוקה"]);
 const siteStart=groups.rowCount+1;
 form.siteCosts.forEach(x=>{const r=groups.rowCount+1;groups.addRow([x.name,x.monthlyCost,{formula:`IF(B${hoursRow}>0,B${r}/B${hoursRow},0)`,result:c.totals.regularSiteHours?x.monthlyCost/c.totals.regularSiteHours:0},c.totals.regularSiteHours]);});
 const siteEnd=groups.rowCount,siteTotal=siteEnd+1;
 groups.addRow(["עלויות אתר ישירות",{formula:siteEnd>=siteStart?`SUM(B${siteStart}:B${siteEnd})`:"0",result:c.totals.siteDirect}]);
 groups.addRow(["תקורה על עלויות האתר",{formula:`B${siteTotal}*C${siteTotal+1}`,result:c.totals.siteOverhead},form.overheadPercent/100]);
 groups.addRow(["רווח על עלויות האתר",{formula:`SUM(B${siteTotal}:B${siteTotal+1})*C${siteTotal+2}`,result:c.totals.siteProfit},form.profitPercent/100]);
 const before=siteTotal+3;
 groups.addRow(["מחיר לפני מע״מ",{formula:`B${workRow}+SUM(B${siteTotal}:B${siteTotal+2})`,result:c.totals.beforeVat}]);
 groups.addRow(["מע״מ",{formula:`B${before}*C${before+1}`,result:c.totals.vat},form.vatPercent/100]);
 groups.addRow(["מחיר כולל מע״מ",{formula:`SUM(B${before}:B${before+1})`,result:c.totals.total}]);
 [siteTotal+1,siteTotal+2,before+1].forEach(r=>groups.getCell(`C${r}`).numFmt="0.00%");
 groups.addRow(["הערות",form.notes]);
 groups.addRow(["גב אל גב","רכיבים מסומנים אינם כלולים בסכום ההצעה; יחויבו בנפרד עם עלויות המעסיק הרלוונטיות לפי זכאות וביצוע."]);
 groups.mergeCells(`B${groups.rowCount}:J${groups.rowCount}`);groups.getRow(groups.rowCount).height=44;
 addWorkbookFormulas(wb,ws,groups,form,c,allReportRows);
 for(const sheet of wb.worksheets){
  sheet.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true};
  // columnCount scans all rows; compute it once for quotes with many groups.
  const width=sheet.columnCount;
  sheet.eachRow(row=>{
   const heading=row.number===1||row.getCell(1).isMerged||["רכיב","עובדים","סעיף","נתון"].includes(String(row.getCell(1).value));
   const total=/^(עלות מעסיק|עלות כוללת|מחיר|עבודה חודשית|עלויות אתר ישירות)/.test(String(row.getCell(1).value));
   row.height=row.height|| (sheet===ws&&row.number>8?58:32);
   for(let col=1;col<=width;col++){
    const cell=row.getCell(col);
    if(cell.isMerged&&cell.master.address!==cell.address)continue;
    if(cell.value==="")cell.value=null;
    cell.font={name:"Arial",size:11,bold:heading||total,color:{argb:heading?"FFFFFFFF":"FF19324A"}};
    cell.alignment={horizontal:col===2||col===3?"center":"right",vertical:"middle",wrapText:true,readingOrder:"rtl"};
    if(typeof cell.value==="number"||cell.type===ExcelJS.ValueType.Formula){if(!cell.numFmt||cell.numFmt==="General")cell.numFmt="#,##0.00;[Red](#,##0.00);\"–\"";}
    cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:heading?"FF075C65":total?"FFE5F6F7":row.number%2?"FFF3FBFC":"FFFFFFFF"}};
    const edge={style:"thin" as const,color:{argb:heading?"FFB7D9DC":"FF78939C"}};
    cell.border={top:edge,bottom:edge,left:edge,right:edge};
   }
  });
 }
 ws.pageSetup.printTitlesRow="1:8";groups.pageSetup.printTitlesRow="1:2";
 wb.calcProperties.fullCalcOnLoad=true;
 return wb;
}
