import {reportClone} from "./local-files";

export type ReportScope="section1"|"full";

// Lay out the real, frozen screen values into A4 pages once. Both the browser
// print dialog and the PDF renderer consume these same pages (no image slicing).
export function preparePrintReport(source:HTMLElement,scope:ReportScope){
 const report=reportClone(source),{holder,copy}=report;
 try{
  holder.style.width="277mm";
  const title=scope==="section1"?"סעיף 1 — עלות שעת עבודה":"הצעת מחיר מלאה";
  const header=copy.querySelector<HTMLElement>(".topbar")!;
  header.querySelector(".brand p")!.textContent=title;
  const client=document.createElement("span");client.className="report-client";
  client.textContent=`${source.querySelector<HTMLInputElement>("#client-name")?.value||"הצעה חדשה"} • ${source.querySelector<HTMLInputElement>('input[type="date"]')?.value||""}`;header.append(client);
  const shell=copy.querySelector<HTMLElement>(".sheet-shell")!;
  const blocks=Array.from(shell.children).flatMap(el=>el.matches("fieldset")?Array.from(el.children):[el])
   .filter(el=>scope==="full"||!el.hasAttribute("data-report-full")) as HTMLElement[];
  copy.replaceChildren();copy.classList.add("report-pages");
  let content:HTMLElement;
  const pages:HTMLElement[]=[];
  function nextPage(){
   const page=document.createElement("article");page.className="report-page";
   const top=header.cloneNode(true) as HTMLElement;top.classList.add("report-page-header");
   content=document.createElement("div");content.className="page-content";
   const footer=document.createElement("footer");footer.className="report-page-footer";
   page.append(top,content,footer);copy.append(page);pages.push(page);
  }
  const overflows=()=>content.scrollHeight>content.clientHeight+1;
  function textBlock(node:HTMLElement){
   const original=node.querySelector<HTMLElement>(".report-value")??(node.matches("p")?node:null);
   if(!original)throw new Error("אחד מסעיפי ההצעה גדול מעמוד A4. יש לקצר את הטקסט ולנסות שוב.");
   // Keep every character, including line breaks; split very long unbroken text too.
   const tokens=(original.textContent??"").match(/\S{1,80}\s*|\s+/gu)??[];
   let offset=0;
   while(offset<tokens.length){
    const part=node.cloneNode(true) as HTMLElement;
    const target=part.querySelector<HTMLElement>(".report-value")??part;
    content.append(part);
    let low=1,high=tokens.length-offset,fit=0;
    while(low<=high){const mid=Math.floor((low+high)/2);target.textContent=tokens.slice(offset,offset+mid).join("");if(overflows())high=mid-1;else{fit=mid;low=mid+1;}}
    if(!fit){part.remove();if(content.children.length){nextPage();continue;}throw new Error("לא ניתן להתאים את הטקסט לעמוד. יש לקצר אותו ולנסות שוב.");}
    target.textContent=tokens.slice(offset,offset+fit).join("");offset+=fit;
    if(offset<tokens.length)nextPage();
   }
  }
  function addBlock(node:HTMLElement){
   const hadContent=content.children.length>0;content.append(node);
   if(!overflows())return;
   node.remove();if(hadContent)nextPage();content.append(node);
   if(overflows()){node.remove();textBlock(node);}
  }
  function addTable(card:HTMLElement,table:HTMLElement){
   const rows=Array.from(table.children) as HTMLElement[];
   const heading=rows.shift();
   if(!heading)return;
   let section:HTMLElement,container:HTMLElement;
   function start(){
    section=card.cloneNode(true) as HTMLElement;
    container=section.querySelector<HTMLElement>(".cost-table,.workforce-table,.site-cost-table")!;
    container.replaceChildren(heading!.cloneNode(true));content.append(section);
   }
   start();
   for(const row of rows){
    container!.append(row);
    if(!overflows())continue;
    row.remove();
    if(container!.children.length===1)section!.remove();
    nextPage();start();container!.append(row);
    if(overflows())throw new Error("שורה בטבלה ארוכה מעמוד A4. יש לקצר את ההסבר או שם הרכיב ולנסות שוב.");
   }
  }
  nextPage();
  for(const block of blocks){
   // Always include explanations in the delivered report. Editable controls have
   // already been replaced by their current values by reportClone.
   block.querySelectorAll<HTMLDetailsElement>("details").forEach(d=>{d.open=true;});
   if(block.matches(".inputs-card")){
    const assumptions=block.querySelector<HTMLElement>(".assumptions");assumptions?.remove();
    addBlock(block);
    if(assumptions){
     const grid=assumptions.querySelector<HTMLElement>(".grid");
     const section=document.createElement("section");section.className="card report-assumptions";
     const heading=document.createElement("h3");heading.textContent="הנחות החישוב";section.append(heading);if(grid)section.append(grid);
     addBlock(section);
     // The provenance paragraphs follow independently, so a table header will
     // never be stranded underneath a large assumptions block.
     assumptions.querySelectorAll<HTMLElement>(":scope > p").forEach(p=>{p.classList.add("report-note");addBlock(p);});
    }
   }else{
    const table=block.querySelector<HTMLElement>(".cost-table,.workforce-table,.site-cost-table");
    if(table)addTable(block,table);else addBlock(block);
   }
  }
  pages.forEach((page,i)=>{page.querySelector("footer")!.textContent=`${title} • עמוד ${i+1} מתוך ${pages.length}`;});
  return report;
 }catch(e){holder.remove();throw e;}
}

let activePrintCleanup:(()=>void)|undefined;
export function printPreparedReport(source:HTMLElement):void{
  activePrintCleanup?.();
  const holder=source.cloneNode(true) as HTMLElement;
  holder.style.cssText="position:fixed;left:-20000px;top:0;width:277mm";document.body.append(holder);
  holder.classList.add("print-surface");document.body.classList.add("printing-report");
  const media=window.matchMedia("print");let entered=false;
  function cleanup(){holder.remove();document.body.classList.remove("printing-report");window.removeEventListener("afterprint",finish);media.removeEventListener("change",changed);activePrintCleanup=undefined;}
  function finish(){cleanup();}
  function changed(event:MediaQueryListEvent){if(event.matches)entered=true;else if(entered)finish();}
  window.addEventListener("afterprint",finish,{once:true});media.addEventListener("change",changed);
  activePrintCleanup=cleanup;
  // Some embedded browsers ignore print without firing afterprint. Keep the
  // frozen report until afterprint/next print, but never lock the editor on it.
  try{window.print();}catch(e){cleanup();throw e;}
}
