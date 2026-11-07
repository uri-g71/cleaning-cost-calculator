import {desc,eq,sql} from "drizzle-orm";
import {getDb} from "../../../db";
import {quotes} from "../../../db/schema";
import {calculate,makeProposal,readProposal} from "../../../lib/calculator";
export async function GET(){try{const rows=await getDb().select().from(quotes).orderBy(desc(quotes.updatedAt)).limit(200);return Response.json({quotes:rows.map(r=>({...r,data:JSON.parse(r.data)}))},{headers:{"Cache-Control":"no-store"}})}catch(e){return Response.json({error:e instanceof Error?e.message:"שגיאה בטעינה"},{status:500})}}
export async function POST(request:Request){
 let body:{id?:number|null;data?:unknown};
 try{body=await request.json();}catch{return Response.json({error:"בקשה לא תקינה"},{status:400});}
 let proposal;
 try{
  const {data}=readProposal(body.data);
  if(!data.clientName.trim())throw new Error("נדרש שם לקוח");
  if(body.id!==undefined&&body.id!==null&&(!Number.isSafeInteger(body.id)||body.id<1))throw new Error("מזהה הצעה לא תקין");
  proposal=makeProposal(data,calculate(data));
 }catch(e){return Response.json({error:e instanceof Error?e.message:"נתוני הצעה לא תקינים"},{status:400});}
 const data=proposal.data,values={clientName:data.clientName.trim(),siteName:data.siteName,quoteDate:data.quoteDate,totalPrice:proposal.snapshot.totals.beforeVat,data:JSON.stringify(proposal),updatedAt:sql`CURRENT_TIMESTAMP`};
 try{
  if(body.id){const[quote]=await getDb().update(quotes).set(values).where(eq(quotes.id,body.id)).returning();if(!quote)return Response.json({error:"ההצעה לא נמצאה; יש לשמור כהצעה חדשה"},{status:404});return Response.json({quote});}
  const[quote]=await getDb().insert(quotes).values(values).returning();return Response.json({quote},{status:201});
 }catch{return Response.json({error:"השרת לא הצליח לשמור את ההצעה. אפשר לשמור קובץ מקומי ולנסות שוב מאוחר יותר."},{status:500});}
}
export async function DELETE(request:Request){
 const id=Number(new URL(request.url).searchParams.get("id"));
 if(!Number.isSafeInteger(id)||id<1)return Response.json({error:"מזהה הצעה לא תקין"},{status:400});
 try{
  const [deleted]=await getDb().delete(quotes).where(eq(quotes.id,id)).returning({id:quotes.id});
  if(!deleted)return Response.json({error:"ההצעה כבר אינה קיימת"},{status:404});
  return Response.json({ok:true,id:deleted.id});
 }catch{return Response.json({error:"המחיקה לא הושלמה. ההצעה נשארה ברשימה; נסה שוב."},{status:500});}
}
