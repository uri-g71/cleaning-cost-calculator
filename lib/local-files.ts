import type {SavedProposal} from "./calculator";
type SaveHandle={createWritable:()=>Promise<{write:(data:Blob)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>}>};
type PickerWindow=Window&{showSaveFilePicker?:(options:unknown)=>Promise<SaveHandle>};
export const fileName=(client:string,date:string,extension:string)=>("הצעה-"+(client||"חדשה")+"-"+date).replace(/[\\/:*?"<>|\u0000-\u001f]/g,"-").slice(0,170)+"."+extension;
// Must be called directly in the click handler, before awaiting imports/rendering.
export function chooseFile(name:string,extension:string,mime:string,choose:boolean):Promise<SaveHandle|null>{
 const picker=(window as PickerWindow).showSaveFilePicker;
 if(!choose||!picker)return Promise.resolve(null);
 return picker.call(window,{suggestedName:name,types:[{description:extension.toUpperCase(),accept:{[mime]:["."+extension]}}]});
}
export async function writeLocal(blob:Blob,handle:SaveHandle|null){
 if(!handle)return false;
 const stream=await handle.createWritable();
 try{await stream.write(blob);await stream.close();}catch(e){await stream.abort().catch(()=>{});throw e;}
 return true;
}
export function reportClone(source:HTMLElement){
 const holder=document.createElement("div");holder.className="report-holder";holder.style.cssText="position:fixed;left:-20000px;top:0;width:1200px;background:#eef3f5";
 const copy=source.cloneNode(true) as HTMLElement;holder.appendChild(copy);copy.classList.add("report-copy");
 const originals=source.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input,select,textarea");
 copy.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input,select,textarea").forEach((el,i)=>{
  const original=originals[i];const text=document.createElement("span");text.className="report-value";
  if(original instanceof HTMLInputElement&&original.type==="checkbox"){text.textContent=original.checked?"✓":"☐";text.className="report-check";}
  else{text.textContent=original instanceof HTMLSelectElement?original.selectedOptions[0]?.textContent||original.value:original.value||"—";}
  el.replaceWith(text);
 });
 copy.querySelectorAll(".no-print,.actions,.final-actions,.history,[role=status],.add-row,button").forEach(el=>el.remove());
 copy.querySelectorAll("fieldset").forEach(el=>el.removeAttribute("disabled"));
 document.body.appendChild(holder);return {holder,copy};
}
export function standaloneHtml(copy:HTMLElement,proposal:SavedProposal){
 const styles=Array.from(document.styleSheets).map(sheet=>{try{return Array.from(sheet.cssRules).map(r=>r.cssText).join("\n");}catch{return "";}}).join("\n");
 const data=JSON.stringify(proposal).replace(/</g,"\\u003c");
 return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>הצעת מחיר</title><style>${styles.replace(/<\/style/gi,"<\\/style")}</style></head><body>${copy.outerHTML}<script id="proposal-data" type="application/json">${data}</script></body></html>`;
}
