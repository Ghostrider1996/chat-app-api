import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const chats = pgTable("chats", {
    id: serial("id").primaryKey(),
    userId: text("userId").notNull(),
    message: text("message").notNull(),
    reply: text("reply").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
});

export const users = pgTable("users", {
    userId: text("userId").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
});

export type ChatInsert = typeof chats.$inferInsert;
export type ChatSelect = typeof chats.$inferInsert;
export type UserInsert = typeof users.$inferInsert;
export type UserSelect = typeof users.$inferInsert;