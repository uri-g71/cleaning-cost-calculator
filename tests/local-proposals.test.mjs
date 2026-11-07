import assert from "node:assert/strict";
import test, {after} from "node:test";
import {readFile} from "node:fs/promises";
import {createServer} from "vite";

const vite = await createServer({configFile:false,appType:"custom",cacheDir:"node_modules/.vite-test-local",server:{middlewareMode:true}});
after(()=>vite.close());
const {createLocalQuoteStore,LOCAL_QUOTES_KEY} = await vite.ssrLoadModule("/lib/local-proposals.ts");
const {initial,makeProposal} = await vite.ssrLoadModule("/lib/calculator.ts");
const proposal = (name="לקוח לבדיקה")=>makeProposal({...initial(),clientName:name});
function memory() {
  const values=new Map();
  return {values,blocked:false,getItem:key=>values.get(key)??null,setItem(key,value){if(this.blocked)throw new Error("quota");values.set(key,value);}};
}

test("save, reopen, edit and permanently delete across store instances",()=>{
  const disk=memory(),store=createLocalQuoteStore(disk);
  const first=store.save(proposal());
  assert.deepEqual(createLocalQuoteStore(disk).list()[0].data,first.data);
  const edited=proposal("לקוח מעודכן");store.save(edited,first.id);
  assert.equal(store.list().length,1);assert.equal(store.list()[0].clientName,"לקוח מעודכן");
  store.delete(first.id);assert.deepEqual(createLocalQuoteStore(disk).list(),[]);
  assert.throws(()=>store.save(edited,first.id),/נמחקה/);
  assert.ok(store.save(proposal()).id>first.id);
});

test("historical prices survive save and backup without recalculation",()=>{
  const historic=proposal();historic.calculationVersion="historical-price";
  historic.snapshot.sample.regular.total=98.765;historic.snapshot.totals.beforeVat=123456;
  const store=createLocalQuoteStore(memory());store.save(historic);
  const backup=JSON.parse(JSON.stringify(store.backup()));
  const restored=createLocalQuoteStore(memory());assert.equal(restored.importBackup(backup),1);
  assert.deepEqual(restored.list()[0].data,historic);
  assert.equal(restored.list()[0].totalPrice,123456);
});

test("backup merges with existing proposals, assigns fresh IDs and skips duplicates",()=>{
  const a=createLocalQuoteStore(memory()),b=createLocalQuoteStore(memory());
  const p=proposal("א");a.save(p);b.save(proposal("ב"));
  assert.equal(b.importBackup(a.backup()),1);assert.equal(b.importBackup(a.backup()),0);
  assert.equal(b.list().length,2);assert.equal(new Set(b.list().map(q=>q.id)).size,2);
  assert.ok(b.list().some(q=>q.clientName==="ב"));
});

test("bad backups, full storage and corrupted data do not overwrite saved proposals",()=>{
  const disk=memory(),store=createLocalQuoteStore(disk);store.save(proposal());
  const before=disk.getItem(LOCAL_QUOTES_KEY);
  assert.throws(()=>store.importBackup({format:"cleaning-proposals-backup",schemaVersion:1,proposals:[proposal("חדש"),{}]}));
  assert.equal(disk.getItem(LOCAL_QUOTES_KEY),before);
  disk.blocked=true;
  assert.throws(()=>store.save(proposal()),/לא נשמרה/);
  assert.throws(()=>store.delete(store.list()[0].id),/לא נשמרה/);
  assert.equal(disk.getItem(LOCAL_QUOTES_KEY),before);
  disk.blocked=false;disk.values.set(LOCAL_QUOTES_KEY,"broken-data");
  assert.throws(()=>store.save(proposal()),/לא שונו/);
  assert.equal(disk.getItem(LOCAL_QUOTES_KEY),"broken-data");
});

test("static entry uses relative assets and the calculator has no server storage requests",async()=>{
  const html=await readFile(new URL("../dist/index.html",import.meta.url),"utf8");
  assert.match(html,/lang="he" dir="rtl"/);assert.match(html,/src="\.\/assets\//);
  assert.doesNotMatch(html,/chatgpt|cloudflare|src="\/assets/);
  const source=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(source,/fetch\(|\/api\/quotes/);
  assert.match(source,/browserQuoteStore\(\)\.save/);
});
