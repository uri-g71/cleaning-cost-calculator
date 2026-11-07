// Minimal typed Worker bindings used by this app. Kept local so type-checking
// does not need to contact Cloudflare or mutate runtime configuration.
interface Fetcher { fetch(request:Request):Promise<Response> }
interface D1Result<T=Record<string,unknown>> { results:T[];success:boolean;meta:Record<string,unknown>;error?:string }
interface D1PreparedStatement {
 bind(...values:unknown[]):D1PreparedStatement;
 all<T=Record<string,unknown>>():Promise<D1Result<T>>;
 first<T=Record<string,unknown>>(column?:string):Promise<T|null>;
 raw<T=unknown[]>():Promise<T[]>;
 run<T=Record<string,unknown>>():Promise<D1Result<T>>;
}
interface D1Database {
 prepare(query:string):D1PreparedStatement;
 batch<T=Record<string,unknown>>(statements:D1PreparedStatement[]):Promise<D1Result<T>[]>;
 exec(query:string):Promise<{count:number;duration:number}>;
}
declare module "cloudflare:workers" { export const env:{DB?:D1Database;ASSETS?:Fetcher}; }
