import assert from "node:assert/strict";
import test,{after} from "node:test";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DatabaseSync} from "node:sqlite";
import {createServer} from "vite";

// Exercise the real route handlers and their SQL against a disposable on-disk
// SQLite database. No customer data or preview/production database is touched.
const directory=await mkdtemp(join(tmpdir(),"cleaning-quotes-")),path=join(directory,"quotes.sqlite");
const sqlDb=new DatabaseSync(path);
sqlDb.exec(await readFile(new URL("../drizzle/0000_tiresome_betty_brant.sql",import.meta.url),"utf8"));sqlDb.close();
const vite=await createServer({configFile:false,appType:"custom",cacheDir:"node_modules/.vite-test-api",server:{middlewareMode:true,hmr:false},plugins:[{
 name:"disposable-sqlite-binding",enforce:"pre",
 resolveId(source,importer){if(source==="../../../db"&&importer?.endsWith("/app/api/quotes/route.ts"))return "\0test-quotes-db";},
 load(id){if(id!=="\0test-quotes-db"&&!id.endsWith("/db/index.ts"))return;return `
  import {DatabaseSync} from "node:sqlite";
  import {drizzle} from "drizzle-orm/sqlite-proxy";
  const db=drizzle(async (sql,params,method)=>{
   const connection=new DatabaseSync(${JSON.stringify(path)});
   try{const statement=connection.prepare(sql);
    if(method==="run"){statement.run(...params);return {rows:[]};}
    const rows=statement.all(...params).map(row=>Object.values(row));return {rows:method==="get"?rows[0]:rows};
   }finally{connection.close();}
  });
  export function getDb(){return db;}
 `;}
}]});
after(async()=>{await vite.close();await rm(directory,{recursive:true,force:true});});
const route=await vite.ssrLoadModule("/app/api/quotes/route.ts");
const {initial,makeProposal}=await vite.ssrLoadModule("/lib/calculator.ts");
const request=(method,body,query="")=>new Request("http://calculator.test/api/quotes"+query,{method,...(body?{headers:{"content-type":"application/json"},body:JSON.stringify(body)}:{})});

test("save, reopen, update and permanently delete without affecting other proposals",async()=>{
 const proposal=makeProposal({...initial(),clientName:"בדיקה זמנית",holidayGiftAmount:450,baseMonthlyHours:91});
 const response=await route.POST(request("POST",{data:proposal}));assert.equal(response.status,201);const {quote}=await response.json();
 const other=await (await route.POST(request("POST",{data:makeProposal({...initial(),clientName:"הצעה שנשמרת"})}))).json();
 const list=await route.GET();assert.equal(list.headers.get("Cache-Control"),"no-store");
 const loaded=(await list.json()).quotes.find(q=>q.id===quote.id);assert.equal(loaded.data.data.holidayGiftAmount,450);assert.equal(loaded.data.snapshot.sample.gift.monthly,75);
 const updated=await route.POST(request("POST",{id:quote.id,data:makeProposal({...proposal.data,holidayGiftBackToBack:true})}));assert.equal(updated.status,200);
 assert.equal((await route.GET().then(r=>r.json())).quotes.find(q=>q.id===quote.id).data.snapshot.sample.gift.hourly,0);
 for(const id of ["", "-1", "1.5", "garbage"]){assert.equal((await route.DELETE(request("DELETE",null,`?id=${id}`))).status,400);}
 assert.equal((await route.DELETE(request("DELETE",null,`?id=${quote.id}`))).status,200);
 assert.equal((await route.DELETE(request("DELETE",null,`?id=${quote.id}`))).status,404);
 // Each query opens a fresh connection, proving the deletion survives reloads.
 const remaining=(await route.GET().then(r=>r.json())).quotes;assert.equal(remaining.length,1);assert.equal(remaining[0].id,other.quote.id);
 const reopened=new DatabaseSync(path);assert.equal(reopened.prepare("SELECT COUNT(*) AS n FROM quotes WHERE id = ?").get(quote.id).n,0);reopened.close();
});

test("invalid proposals and missing updates do not overwrite existing data",async()=>{
 assert.equal((await route.POST(request("POST",{data:makeProposal(initial())}))).status,400);
 const proposal=makeProposal({...initial(),clientName:"בדיקה"});
 assert.equal((await route.POST(request("POST",{id:999999,data:proposal}))).status,404);
 const broken={...proposal,data:{...proposal.data,holidayGiftAmount:-300}};
 assert.equal((await route.POST(request("POST",{data:broken}))).status,400);
});
