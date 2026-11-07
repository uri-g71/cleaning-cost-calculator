"use client";
import {useEffect,useRef,useState} from "react";
import {Calculator,ChevronDown,Download,FolderOpen,History,Plus,Printer,Save,Trash2} from "lucide-react";
import {CALCULATION_VERSION,calculate,initial,makeProposal,parseForm,readProposal,uid,type FormData,type Job,type SavedProposal} from "../lib/calculator";
import {money,allReportRows,type WageRow} from "../lib/report";
import {chooseFile,fileName,standaloneHtml,writeLocal} from "../lib/local-files";
import {preparePrintReport,printPreparedReport,type ReportScope} from "../lib/print-report";

type Quote={id:number;clientName:string;siteName:string;quoteDate:string;totalPrice:number;data:unknown};
const num=(value:string)=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
function Field({label,value,onChange,suffix,step=".01"}:{label:string;value:number;onChange:(v:number)=>void;suffix?:string;step?:string}){
 return <label className="field"><span>{label}</span><div className="input-wrap"><input type="number" min="0" step={step} value={value} onChange={e=>onChange(num(e.target.value))}/>{suffix&&<b>{suffix}</b>}</div></label>;
}
export default function Home(){
 const [form,setForm]=useState<FormData>(initial),[quotes,setQuotes]=useState<Quote[]>([]),[quoteId,setQuoteId]=useState<number|null>(null);
 const [saved,setSaved]=useState<SavedProposal|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
 const [savedSignature,setSavedSignature]=useState<string|null>(null),[pendingDelete,setPendingDelete]=useState<Quote|null>(null);
 const [printPreview,setPrintPreview]=useState<HTMLElement|null>(null);
 const [chooseLocation,setChooseLocation]=useState(false),[download,setDownload]=useState<{url:string;name:string}|null>(null);
 const fileInput=useRef<HTMLInputElement>(null),reportRoot=useRef<HTMLElement>(null),deleteDialog=useRef<HTMLDialogElement>(null);
 const openedQuoteId=useRef<number|null>(null);
 const printDialog=useRef<HTMLDialogElement>(null),printMount=useRef<HTMLDivElement>(null);
 const calculation=saved?.snapshot??calculate(form),{sample,totals,errors}=calculation;
 const canPrintFull=!!saved||savedSignature===JSON.stringify(form);
 const set=<K extends keyof FormData>(key:K,value:FormData[K])=>setForm(f=>({...f,[key]:value}));
 useEffect(()=>{let live=true;fetch("/api/quotes").then(async r=>{if(!r.ok)throw new Error();const j=await r.json();if(live)setQuotes(j.quotes);}).catch(()=>{if(live)setStatus("לא ניתן לטעון את ההצעות השמורות. אפשר להמשיך לעבוד ולשמור קובץ מקומי.");});return()=>{live=false;};},[]);
 useEffect(()=>()=>{if(download)URL.revokeObjectURL(download.url);},[download]);
 useEffect(()=>{setDownload(null);},[form]);
 useEffect(()=>{if(pendingDelete)deleteDialog.current?.showModal();else deleteDialog.current?.close();},[pendingDelete]);
 async function reload(){const r=await fetch("/api/quotes");if(!r.ok)throw new Error("ההצעה נשמרה, אך רשימת ההצעות לא התרעננה. רענן את הדף.");setQuotes((await r.json()).quotes);}
 function proposal(){if(saved)return saved;const data=parseForm(form);if(errors.length)throw new Error(errors.join(" "));return makeProposal(data,calculation);}
 function errorText(e:unknown){return e instanceof Error?(e.name==="AbortError"?"הפעולה בוטלה; לא נשמר קובץ.":e.name==="NotAllowedError"||e.name==="SecurityError"?"הדפדפן לא אישר גישה לתיקייה. אפשר לבטל את בחירת התיקייה ולהשתמש בהורדה רגילה.":e.message):"הפעולה לא הצליחה. נסה שוב.";}
 async function save(){
  if(busy)return;
  if(!form.clientName.trim()){setStatus("יש להזין שם לקוח לפני שמירה");document.getElementById("client-name")?.focus();return;}
  setBusy(true);setStatus("שומר הצעה...");
  try{
   const r=await fetch("/api/quotes",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:quoteId,data:proposal()}),signal:AbortSignal.timeout(20000)});
   const j=await r.json();if(!r.ok)throw new Error(j.error||"השמירה לא אושרה. ניתן לשמור קובץ מקומי.");
   if(!j.quote?.id)throw new Error("לא התקבל אישור שמירה");
   setQuoteId(j.quote.id);openedQuoteId.current=j.quote.id;setSavedSignature(JSON.stringify(form));setStatus("ההצעה נשמרה עם הנתונים ותוצאות החישוב. אפשר להדפיס את ההצעה המלאה.");await reload();
  }catch(e){setStatus(errorText(e));}finally{setBusy(false);}
 }
 function loadProposal(value:unknown,id:number|null){
  const result=readProposal(value);setForm(result.data);setSaved(result.proposal);openedQuoteId.current=id;setQuoteId(result.proposal?id:null);setSavedSignature(result.proposal?JSON.stringify(result.data):null);setDownload(null);
  setStatus(result.proposal?"נפתחה ההצעה עם המחירים המקוריים. לעריכה יש ללחוץ על עריכת הצעה.":"זוהי הצעה ישנה ללא עותק תוצאות. הנתונים נטענו לחישוב מחדש; שמירה תיצור הצעה חדשה.");
  scrollTo({top:0,behavior:"smooth"});
 }
 function open(q:Quote){try{loadProposal(q.data,q.id);}catch(e){setStatus(errorText(e));}}
 function newProposal(){setForm(initial());setSaved(null);setQuoteId(null);openedQuoteId.current=null;setSavedSignature(null);setDownload(null);setStatus("");}
 async function deleteQuote(){
  if(!pendingDelete||busy)return;
  const target=pendingDelete;setBusy(true);
  try{
   const r=await fetch(`/api/quotes?id=${target.id}`,{method:"DELETE",signal:AbortSignal.timeout(20000)});
   const result=await r.json();if(!r.ok&&r.status!==404)throw new Error(result.error||"המחיקה לא הושלמה");
   setQuotes(list=>list.filter(q=>q.id!==target.id));
   if(openedQuoteId.current===target.id)newProposal();
   setPendingDelete(null);setStatus(`ההצעה של ${target.clientName} נמחקה לצמיתות.`);
  }catch(e){setStatus(errorText(e));setPendingDelete(null);}finally{setBusy(false);}
 }
 async function importLocal(file:File|undefined){
  if(!file)return;
  try{
   if(file.size>10*1024*1024)throw new Error("קובץ ההצעה גדול מדי (עד 10MB).");
   const text=await file.text();const json=text.trimStart().startsWith("<")?new DOMParser().parseFromString(text,"text/html").querySelector('script#proposal-data[type="application/json"]')?.textContent:text;
   if(!json)throw new Error("הקובץ אינו הצעה שנשמרה מהמחשבון.");loadProposal(JSON.parse(json),null);
  }catch(e){setStatus(errorText(e));}if(fileInput.current)fileInput.current.value="";
 }
 function updateJob(id:string,key:keyof Job,value:number){setForm(f=>({...f,jobs:f.jobs.map(j=>j.id===id?{...j,[key]:value}:j)}));}
 function addCalculatorJob(){if(form.baseMonthlyHours<=0){setStatus("יש להזין כמות שעות גדולה מאפס.");return;}setForm(f=>({...f,jobs:[...f.jobs,{id:uid(),employees:1,tenure:f.tenureYears,workWeek:f.workWeek,regularHours:f.baseMonthlyHours,hours125:0,hours150:0}]}));setStatus("נוספה קבוצה לריכוז כוח האדם. ניתן להוסיף קבוצה נוספת בכל לחיצה.");}
 async function printReport(scope:ReportScope){
  if(busy)return;
  if(scope==="full"&&!canPrintFull){setStatus("יש לשמור את ההצעה לפני הדפסה מלאה.");return;}
  setBusy(true);
  try{
   if(scope==="full")proposal();else makeProposal({...parseForm(form),jobs:[],siteCosts:[]});
   await document.fonts.ready;const report=preparePrintReport(reportRoot.current!,scope);
   report.holder.style.cssText="width:277mm";printMount.current!.replaceChildren(report.holder);
   setPrintPreview(report.holder);printDialog.current?.showModal();
  }catch(e){setStatus(errorText(e));}finally{setBusy(false);}
 }
 function closePrintPreview(){printDialog.current?.close();printPreview?.remove();setPrintPreview(null);}
 async function exportFile(extension:"xlsx"|"pdf"|"html"){
  if(busy)return;
  const mime=extension==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":extension==="pdf"?"application/pdf":"text/html";
  const name=fileName(form.clientName,form.quoteDate,extension);setBusy(true);setStatus("מכין קובץ...");let holder:HTMLElement|undefined;
  try{
   const data=proposal();const handle=await chooseFile(name,extension,mime,chooseLocation);let blob:Blob;
   if(extension==="xlsx"){
    const {buildWorkbook}=await import("../lib/report");const wb=await buildWorkbook(form,calculation,data.calculationVersion);
    blob=new Blob([await wb.xlsx.writeBuffer() as BlobPart],{type:mime});
   }else{
    await document.fonts.ready;
    const report=preparePrintReport(reportRoot.current!,"full");holder=report.holder;
    if(extension==="html")blob=new Blob([standaloneHtml(report.copy,data)],{type:"text/html;charset=utf-8"});
    else{
     const [{default:html2canvas},{jsPDF}]=await Promise.all([import("html2canvas"),import("jspdf")]);
     const pdf=new jsPDF({unit:"mm",format:"a4",orientation:"landscape"});pdf.setProperties({title:`הצעת מחיר — ${form.clientName}`,subject:`גרסת חישוב ${data.calculationVersion}`,creator:"מחשבון תמחיר שירותי ניקיון"});
     const pages=Array.from(holder.querySelectorAll<HTMLElement>(".report-page"));
     for(let i=0;i<pages.length;i++){
      const canvas=await html2canvas(pages[i],{scale:2,backgroundColor:"#ffffff",windowWidth:1200,windowHeight:900,scrollY:0,scrollX:0});
      if(i)pdf.addPage();pdf.addImage(canvas.toDataURL("image/png"),"PNG",10,10,277,190);
     }blob=pdf.output("blob");
    }
   }
   if(await writeLocal(blob,handle)){if(extension==="html")setSavedSignature(JSON.stringify(form));setStatus("הקובץ נשמר במיקום שבחרת.");}
   else{setDownload({url:URL.createObjectURL(blob),name});setStatus("הקובץ מוכן. לחץ על הורדת הקובץ כדי לשמור במחשב.");}
  }catch(e){setStatus(errorText(e));}finally{holder?.remove();setBusy(false);}
 }
 const amount=(value:number)=>sample.valid?money(value):"—";
 function renderRow([name,value,help,rate,id]:WageRow){
  const flag=id==="holiday"?"holidayBackToBack":id==="sick"?"sickBackToBack":id==="travel"?"travelBackToBack":id==="excellence"?"excellenceBackToBack":id==="gift"?"holidayGiftBackToBack":null;
  const bb=flag?form[flag]:false;
  const monthly=id==="travel"?<Field label="עלות נסיעות חודשית" value={form.monthlyTravel} onChange={v=>set("monthlyTravel",v)} suffix="₪"/>:id==="materials"?<Field label="עלות חומרים חודשית" value={form.monthlyMaterials} onChange={v=>set("monthlyMaterials",v)} suffix="₪"/>:id==="other"?<><label className="field"><span>מהות העלות</span><input value={form.otherCostDescription} onChange={e=>set("otherCostDescription",e.target.value)}/></label><Field label="עלות חודשית נוספת" value={form.monthlyOther} onChange={v=>set("monthlyOther",v)} suffix="₪"/></>:id==="overhead"?<Field label="שיעור תקורה" value={form.overheadPercent} onChange={v=>set("overheadPercent",v)} suffix="%"/>:id==="profit"?<Field label="שיעור רווח" value={form.profitPercent} onChange={v=>set("profitPercent",v)} suffix="%"/>:id==="gift"?<div className="gift-input"><Field label="סכום שי לכל חג" value={form.holidayGiftAmount} onChange={v=>set("holidayGiftAmount",v)} suffix="₪"/><span>עלות חודשית לעובד: <b>{money(sample.gift.monthly)}</b>{bb?" • לחיוב נפרד":""}</span></div>:null;
  return <div className={`tr ${["employer","direct"].includes(id)?"total-row":id==="price"?"final-row":""}`} key={id} data-row={id}>
   <strong>{name} {rate&&<b>({bb?"גב אל גב":rate})</b>}</strong>
   {id==="excellence"&&!bb&&form.excellenceInputMode==="hourly"?<Field label="מענק לשעה" value={form.excellenceHourly} onChange={v=>set("excellenceHourly",v)} suffix="₪"/>:<b>{amount(value)}</b>}
   <div className="row-help">
    {flag&&<label className="bb-check"><input aria-label={`גב אל גב — ${name}`} type="checkbox" checked={bb} onChange={e=>set(flag,e.target.checked)}/><span>גב אל גב</span></label>}
    {id==="travelPension"&&<label className="bb-check"><input type="checkbox" checked={form.travelBackToBack} disabled/><span>גב אל גב — מקושר לנסיעות</span></label>}
    {id==="excellence"&&<><label className="field"><span>אופן הזנת המענק</span><select value={form.excellenceInputMode} onChange={e=>set("excellenceInputMode",e.target.value as "hourly"|"monthly")}><option value="hourly">סכום לשעה</option><option value="monthly">סכום חודשי</option></select></label>{form.excellenceInputMode==="monthly"&&<Field label="מענק חודשי" value={form.excellenceMonthly} onChange={v=>set("excellenceMonthly",v)} suffix="₪"/>}</>}
    {monthly}<details><summary>הסבר <ChevronDown/></summary><p>{help}</p></details>
   </div>
  </div>;
 }
 return <main dir="rtl" ref={reportRoot}>
  <header className="topbar"><div className="brand"><span className="logo"><Calculator/></span><div><h1>תמחיר שירותי ניקיון</h1><p>עלות שעה מפורטת ותמחור אתר</p></div></div><div className="actions"><button className="secondary" disabled={busy} onClick={newProposal}><Plus/>חדש</button><button className="secondary" disabled={busy} onClick={()=>fileInput.current?.click()}><FolderOpen/>פתיחה מהמחשב</button><button className="primary" onClick={save} disabled={busy||!!saved}><Save/>שמירה</button></div></header>
  <input className="no-print" hidden ref={fileInput} type="file" accept=".html,.json" aria-label="קובץ הצעה מהמחשב" onChange={e=>void importLocal(e.target.files?.[0])}/>
  <div className="sheet-shell">
   <div className="print-actions no-print"><div className="print-buttons"><button onClick={()=>void printReport("section1")} disabled={busy||form.baseMonthlyHours<=0}><Printer/>הדפסת סעיף 1</button><button onClick={()=>void printReport("full")} disabled={busy||!canPrintFull||!!errors.length}><Printer/>הדפסת הצעה מלאה</button></div><span>{canPrintFull?"הדפסת A4 או שמירה כ־PDF בחלון ההדפסה":"להדפסה מלאה יש לשמור את ההצעה לאחר השינוי האחרון."}</span></div>
   {status&&<p role="status" className="status-message">{status}</p>}
   {saved&&<div className="saved-notice no-print"><span>תצוגה שמורה • {saved.calculationVersion} • המחירים המקוריים נשמרו.</span><button onClick={()=>{if(saved.calculationVersion!==CALCULATION_VERSION)setQuoteId(null);setSaved(null);setSavedSignature(null);setDownload(null);setStatus("ההצעה נפתחה לעריכה וחושבה לפי הגרסה הנוכחית.");}}>עריכת הצעה</button></div>}
   {errors.length>0&&<div role="alert" className="validation no-print">{errors.map(e=><p key={e}>{e}</p>)}</div>}
   <fieldset disabled={!!saved||busy} className="calculator-fields">
    <section className="intro card"><div className="section-number">1</div><div><h2>עלות שעת עבודה ומחיר מכירה</h2><p>כל רכיבי העלות מוצגים ברצף אחד, כולל נסיעות, חומרים, תקורה ורווח.</p></div></section>
    <section className="card inputs-card"><div className="section-head"><h3>נתוני בסיס</h3></div><div className="grid four">
     <label className="field"><span>שם לקוח</span><input id="client-name" value={form.clientName} onChange={e=>set("clientName",e.target.value)}/></label><label className="field"><span>אתר</span><input value={form.siteName} onChange={e=>set("siteName",e.target.value)}/></label>
     <Field label="שכר יסוד" value={form.baseWage} onChange={v=>set("baseWage",v)} suffix="₪"/><Field label="וותק" value={form.tenureYears} onChange={v=>set("tenureYears",Math.round(v*2)/2)} suffix="שנים" step=".5"/>
     <label className="field"><span>ימי עבודה</span><select value={form.workWeek} onChange={e=>set("workWeek",Number(e.target.value) as Job["workWeek"])}>{[1,2,3,4,5,6].map(days=><option key={days} value={days}>{days} ימים</option>)}</select></label>
     <Field label="כמות שעות לחישוב" value={form.baseMonthlyHours} onChange={v=>set("baseMonthlyHours",v)} suffix="ש׳"/><Field label="מדרגת ביטוח לאומי מופחתת" value={form.niThresholdMonthly} onChange={v=>set("niThresholdMonthly",v)} suffix="₪"/>
     <label className="field"><span>תאריך הצעת מחיר</span><input type="date" value={form.quoteDate} onChange={e=>set("quoteDate",e.target.value)}/></label>
    </div>
    <details className="assumptions"><summary>מקורות והנחות החישוב</summary><div className="grid three">
     <label className="field"><span>בסיס חופשה והבראה</span><select value={form.leaveBasis} onChange={e=>set("leaveBasis",e.target.value as FormData["leaveBasis"])}><option value="workbook">נוסחאות האקסל שהועלה</option><option value="actual">בסיס שעות עבודה בפועל</option></select></label>
     <Field label="שכר בסיס ענפי לקרן השתלמות" value={form.sectorWage} onChange={v=>set("sectorWage",v)} suffix="₪"/><Field label="תקרת חיוב ביטוח לאומי" value={form.niMaximumMonthly} onChange={v=>set("niMaximumMonthly",v)} suffix="₪"/>
     <Field label="אומדן מחלה לתמחור בלבד" value={form.sickRate} onChange={v=>set("sickRate",v)} suffix="%"/><Field label="מע״מ" value={form.vatPercent} onChange={v=>set("vatPercent",v)} suffix="%"/>
    </div><p>טבלאות צבירת החופשה וההבראה נשמרו לפי הקובץ שהועלה. ברירת המחדל שומרת את נוסחאות האקסל. בסיס שעות עבודה בפועל מנכה שעות חופשה מהבסיס השנתי לשני הרכיבים, ולכן נותן תעריפים שונים. אין לערבב בין שיטות בתוך הצעה.</p><p>תעריפים לפי הודעת תכ״ם H.8.2.1 מהדורה 40 שהועלתה (24.6.2026). <a href="https://www.btl.gov.il/English%20Homepage/Insurance/Ratesandamount/Pages/forSalaried.aspx" target="_blank" rel="noreferrer">מדרגות ביטוח לאומי 2026</a> לעובד תושב ישראל מגיל 18 עד גיל פרישה. זהו תמחיר ולא תלוש שכר; זכאות אישית, ניצול מחלה וחג והעסקה מעבר למשרה מלאה דורשים בדיקת חשבות שכר.</p></details>
    </section>
    <section className="card table-card"><div className="section-head"><h3>מחשבון עלות</h3></div><div className="cost-table"><div className="tr th"><span>רכיב ושיעור חישוב</span><span>עלות לשעה</span><span>הסבר / פעולה</span></div>{allReportRows(form,calculation).map(renderRow)}</div></section>
    <section className="rate-cards"><article><span>מחיר שעה רגילה</span><strong>{amount(sample.regular.total)}</strong></article><article><span>מחיר שעת 125%</span><strong>{amount(sample.p125.total)}</strong></article><article><span>מחיר שעת 150%</span><strong>{amount(sample.p150.total)}</strong></article></section>
    <p className="report-note">תעריפי שעות נוספות לעיל הם תעריפים שוליים לאחר השעות הרגילות. בקבוצות העובדים מחושב הביטוח הלאומי על מלוא השכר החודשי. עלויות שהוזנו כחודשיות נכללות פעם אחת בלבד. אחוזי ההפרשות הם שיעורי ההפרשה; בשאר הרכיבים מוצג היחס לשכר היסוד, ובמחלה שיעור האומדן.</p>
    <section className="card no-print"><div className="section-head"><div><h3>הוספת עובד לתמחור האתר</h3><span>כל לחיצה מוסיפה קבוצה עם הוותק, שבוע העבודה וכמות השעות שבמחשבון</span></div><button className="add-row" onClick={addCalculatorJob}><Plus/>הוספת עובד לתמחור האתר</button></div></section>
    <section data-report-full className="intro card stage-two"><div className="section-number">2</div><div><h2>ריכוז כוח האדם באתר</h2><p>ריכוז העובדים, הוותק והשעות לפני גיבוש ההצעה הסופית.</p></div></section>
    <section data-report-full className="card"><div className="section-head"><h3>קבוצות כוח אדם</h3><button className="add-row" onClick={addCalculatorJob}><Plus/>הוספת קבוצה נוספת</button></div><p className="plain-help">הוותק והשעות נקבעים לכל קבוצה. שכר היסוד, עלויות העובד והנחות החישוב משותפים לכל הקבוצות; שינוי בהם מעדכן את האתר כולו.</p><div className="workforce-table"><div className="wf-row wf-head"><span>עובדים</span><span>וותק</span><span>שבוע</span><span>שעות רגילות</span><span>125%</span><span>150%</span><span>מחיר חודשי</span><span></span></div>
     {totals.jobRows.map((j,i)=><div className="wf-row" key={j.id}>
      <input aria-label={`מספר עובדים בקבוצה ${i+1}`} type="number" min="1" step="1" value={j.employees} onChange={e=>updateJob(j.id,"employees",num(e.target.value))}/><input aria-label={`וותק בקבוצה ${i+1}`} type="number" min="0" step=".5" value={j.tenure} onChange={e=>updateJob(j.id,"tenure",Math.round(num(e.target.value)*2)/2)}/>
      <select aria-label={`ימי עבודה בקבוצה ${i+1}`} value={j.workWeek} onChange={e=>updateJob(j.id,"workWeek",Number(e.target.value))}>{[1,2,3,4,5,6].map(days=><option key={days} value={days}>{days} ימים</option>)}</select>
      <input aria-label={`שעות רגילות בקבוצה ${i+1}`} type="number" min="0" value={j.regularHours} onChange={e=>updateJob(j.id,"regularHours",num(e.target.value))}/><input aria-label={`שעות 125% בקבוצה ${i+1}`} type="number" min="0" value={j.hours125} onChange={e=>updateJob(j.id,"hours125",num(e.target.value))}/><input aria-label={`שעות 150% בקבוצה ${i+1}`} type="number" min="0" value={j.hours150} onChange={e=>updateJob(j.id,"hours150",num(e.target.value))}/>
      <b>{j.regularHours>0?money(j.total):"—"}</b><button aria-label={`מחיקת קבוצה ${i+1}`} onClick={()=>set("jobs",form.jobs.filter(x=>x.id!==j.id))}><Trash2/></button>
     </div>)}{!form.jobs.length&&<p className="empty">עדיין לא נוספו עובדים. הוסף קבוצה מהמחשבון.</p>}
    </div></section>
    <section data-report-full className="card"><div className="section-head"><h3>עלויות אתר לפי עלות חודשית</h3><span>עלות לשעה = עלות חודשית ÷ {totals.regularSiteHours} שעות העבודה הרגילות של כלל העובדים</span></div><div className="site-cost-table"><div className="site-row site-head"><span>סעיף</span><span>עלות חודשית</span><span>עלות לשעה</span><span>בסיס החלוקה</span></div>{form.siteCosts.map(x=><div className="site-row" key={x.id}><strong>{x.name}</strong><input aria-label={`עלות חודשית — ${x.name}`} type="number" min="0" step=".01" value={x.monthlyCost} onChange={e=>set("siteCosts",form.siteCosts.map(c=>c.id===x.id?{...c,monthlyCost:num(e.target.value)}:c))}/><b>{totals.regularSiteHours?money(x.monthlyCost/totals.regularSiteHours):"—"}</b><span>{totals.regularSiteHours.toLocaleString("he-IL")} שעות</span></div>)}</div></section>
    <section data-report-full className="card notes-card"><label className="field"><span>הערות להצעה</span><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} rows={3}/></label></section>
   </fieldset>
   <section data-report-full className="final card"><div className="final-lines"><div><span>עבודה חודשית</span><b>{money(totals.work)}</b></div><div><span>עלויות אתר ישירות</span><b>{money(totals.siteDirect)}</b></div><div><span>תקורה על עלויות האתר</span><b>{money(totals.siteOverhead)}</b></div><div><span>רווח על עלויות האתר</span><b>{money(totals.siteProfit)}</b></div></div><div className="final-price"><span>מחיר לפני מע״מ</span><strong>{errors.length?"—":money(totals.beforeVat)}</strong><small>כולל מע״מ: {errors.length?"—":money(totals.total)}</small></div>
    <div className="final-actions"><button onClick={()=>void printReport("full")} disabled={busy||!canPrintFull||!!errors.length}><Printer/>הדפסת הצעה מלאה</button><button onClick={()=>exportFile("pdf")} disabled={busy||!!errors.length}><Download/>PDF</button><button onClick={()=>exportFile("xlsx")} disabled={busy||!!errors.length}><Download/>Excel</button><button onClick={()=>exportFile("html")} disabled={busy||!!errors.length}><Save/>שמירת הצעה במחשב</button><label className="save-location"><input type="checkbox" checked={chooseLocation} onChange={e=>setChooseLocation(e.target.checked)}/>בחירת תיקייה בעת השמירה (בדפדפן תומך)</label></div>
   </section>
   {status&&<p role="note" className="export-status no-print">{status}</p>}
   {download&&<div className="download-ready no-print"><a href={download.url} download={download.name}><Download/>הורדת הקובץ — {download.name}</a><small>אם הדפדפן לא שואל היכן לשמור, הקובץ יישמר בתיקיית ההורדות המוגדרת בו.</small></div>}
   <p className="report-note">גרסת חישוב: {saved?.calculationVersion??CALCULATION_VERSION} • בסיס חופשה והבראה: {form.leaveBasis==="workbook"?"נוסחאות האקסל שהועלה":"שעות עבודה בפועל"}. רכיבי גב אל גב אינם כלולים במחיר; החיוב הנפרד יכלול את עלויות המעסיק הרלוונטיות בהתאם לזכאות ולביצוע. הקובץ המקומי שומר את המראה והמחירים וניתן לפתוח אותו שוב במחשבון.</p>
   <section className="card history"><div className="section-head"><h3><History/> הצעות שמורות</h3><span>{quotes.length} הצעות</span></div><div className="saved-list">{quotes.map(q=><div className="saved-row" key={q.id}><button className="open-quote" disabled={busy} onClick={()=>open(q)}><span><b>{q.clientName}</b><small>{q.siteName||"ללא אתר"} • {q.quoteDate}</small></span><strong>{money(q.totalPrice)}</strong></button><button className="delete-quote" disabled={busy} aria-label={`מחיקת הצעה — ${q.clientName}`} onClick={()=>setPendingDelete(q)}><Trash2/><span>מחיקה</span></button></div>)}{!quotes.length&&<p className="empty">אין הצעות שמורות להצגה.</p>}</div></section>
  </div>
  <dialog ref={printDialog} className="print-preview no-print" aria-label="תצוגה לפני הדפסה" onCancel={e=>{e.preventDefault();closePrintPreview();}}><div className="preview-actions"><span>תצוגה לפני הדפסה • A4 לרוחב</span><button onClick={()=>{if(printPreview)try{printPreparedReport(printPreview);}catch(e){setStatus(errorText(e));}}}><Printer/>הדפסה / שמירה כ־PDF</button><button onClick={closePrintPreview}>סגירת תצוגה</button></div><div className="preview-scroll" ref={printMount}/></dialog>
  <dialog ref={deleteDialog} className="delete-dialog no-print" aria-labelledby="delete-title" onCancel={e=>{e.preventDefault();if(!busy)setPendingDelete(null);}}><h3 id="delete-title">מחיקת הצעה לצמיתות</h3><p>למחוק את ההצעה של <b>{pendingDelete?.clientName}</b>? ההצעה תימחק מההצעות השמורות ולא ניתן יהיה לשחזר אותה.</p><div><button autoFocus disabled={busy} onClick={()=>setPendingDelete(null)}>ביטול</button><button className="danger" disabled={busy} onClick={()=>void deleteQuote()}>מחיקה לצמיתות</button></div></dialog>
 </main>;
}
