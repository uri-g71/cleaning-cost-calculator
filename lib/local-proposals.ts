import {readProposal, type SavedProposal} from "./calculator";

export const LOCAL_QUOTES_KEY = "cleaning-cost-calculator:quotes:v1";
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export type LocalQuote = {
  id: number; clientName: string; siteName: string; quoteDate: string;
  totalPrice: number; data: SavedProposal; updatedAt: string;
};
type State = {format: "cleaning-local-quotes"; schemaVersion: 1; nextId: number; quotes: LocalQuote[]};

function validatedProposal(value: unknown): SavedProposal {
  const parsed = readProposal(value).proposal;
  if (!parsed) throw new Error("הקובץ אינו מכיל הצעה שמורה עם תוצאות חישוב.");
  return parsed;
}
function quote(id: number, data: SavedProposal, updatedAt: string): LocalQuote {
  return {id, data, updatedAt, clientName: data.data.clientName, siteName: data.data.siteName,
    quoteDate: data.data.quoteDate, totalPrice: data.snapshot.totals.beforeVat};
}

// One atomic write for the collection. Failed reads/writes never clear old data.
export function createLocalQuoteStore(storage: StorageAccess) {
  function read(): State {
    let text: string | null;
    try { text = storage.getItem(LOCAL_QUOTES_KEY); }
    catch { throw new Error("הדפדפן חסם גישה להצעות המקומיות. אפשר לשמור הצעה לקובץ במחשב."); }
    if (text === null) return {format: "cleaning-local-quotes", schemaVersion: 1, nextId: 1, quotes: []};
    try {
      const raw = JSON.parse(text);
      if (raw.format !== "cleaning-local-quotes" || raw.schemaVersion !== 1 || !Array.isArray(raw.quotes)
        || !Number.isSafeInteger(raw.nextId) || raw.nextId < 1) throw new Error();
      const ids = new Set<number>();
      const quotes = raw.quotes.map((item: LocalQuote) => {
        if (!Number.isSafeInteger(item.id) || item.id < 1 || item.id >= raw.nextId || ids.has(item.id)
          || typeof item.updatedAt !== "string") throw new Error();
        ids.add(item.id);
        return quote(item.id, validatedProposal(item.data), item.updatedAt);
      });
      return {...raw, quotes};
    } catch { throw new Error("לא ניתן לקרוא את ההצעות המקומיות. הנתונים הקיימים לא שונו. יש לשחזר גיבוי בדפדפן אחר או לשמור את ההצעה הנוכחית לקובץ."); }
  }
  function write(state: State) {
    try { storage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(state)); }
    catch { throw new Error("ההצעה לא נשמרה: האחסון המקומי מלא או חסום. שמור קובץ במחשב; ההצעות הקודמות לא שונו."); }
  }
  return {
    list() { return read().quotes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id); },
    save(value: unknown, id: number | null = null) {
      const data = validatedProposal(value), state = read();
      if (id !== null && !state.quotes.some(q => q.id === id))
        throw new Error("ההצעה נמחקה בחלון אחר. שמור אותה לקובץ מקומי או פתח הצעה חדשה.");
      const record = quote(id ?? state.nextId++, data, new Date().toISOString());
      state.quotes = [...state.quotes.filter(q => q.id !== record.id), record];
      write(state); return record;
    },
    delete(id: number) {
      const state = read(); state.quotes = state.quotes.filter(q => q.id !== id); write(state);
    },
    backup() {
      return {format: "cleaning-proposals-backup", schemaVersion: 1, createdAt: new Date().toISOString(),
        proposals: read().quotes.map(q => q.data)};
    },
    importBackup(value: unknown) {
      const raw = value as {format?: string; schemaVersion?: number; proposals?: unknown[]};
      if (raw?.format !== "cleaning-proposals-backup" || raw.schemaVersion !== 1 || !Array.isArray(raw.proposals))
        throw new Error("הקובץ אינו גיבוי הצעות של המחשבון.");
      // Validate all entries first; merge backups without replacing existing proposals.
      const proposals = raw.proposals.map(validatedProposal), state = read();
      const seen = new Set(state.quotes.map(q => JSON.stringify(q.data)));
      let added = 0;
      for (const data of proposals) {
        const signature = JSON.stringify(data); if (seen.has(signature)) continue;
        state.quotes.push(quote(state.nextId++, data, new Date().toISOString()));
        seen.add(signature); added++;
      }
      if (added) write(state); return added;
    },
  };
}
export function browserQuoteStore() {
  try { return createLocalQuoteStore(window.localStorage); }
  catch { throw new Error("הדפדפן חסם אחסון מקומי. אפשר להשתמש בשמירת הצעה לקובץ במחשב."); }
}
