import {sql} from "drizzle-orm";
import {integer,real,sqliteTable,text} from "drizzle-orm/sqlite-core";
export const quotes=sqliteTable("quotes",{id:integer("id").primaryKey({autoIncrement:true}),clientName:text("client_name").notNull(),siteName:text("site_name").notNull().default(""),quoteDate:text("quote_date").notNull(),totalPrice:real("total_price").notNull(),data:text("data").notNull(),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)});
