import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notebooks = pgTable("notebooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notebookId: varchar("notebook_id").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
  filename: varchar("filename").notNull(),
  title: varchar("title"),
  fileType: varchar("file_type").notNull(),
  content: text("content").notNull(),
  size: integer("size").notNull(),
  embeddingId: varchar("embedding_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatHistory = pgTable("chat_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notebookId: varchar("notebook_id").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
  userPrompt: text("user_prompt").notNull(),
  aiResponse: text("ai_response").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  notebookId: varchar("notebook_id").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  sourceType: varchar("source_type").notNull(), // 'manual' | 'ai_generated'
  aiContentType: varchar("ai_content_type"), // 'study_guide' | 'briefing_doc' | 'faq' | 'timeline' | null for manual notes
  linkedChatId: varchar("linked_chat_id").references(() => chatHistory.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  notebooks: many(notebooks),
}));

export const notebooksRelations = relations(notebooks, ({ one, many }) => ({
  user: one(users, {
    fields: [notebooks.userId],
    references: [users.id],
  }),
  documents: many(documents),
  chatHistory: many(chatHistory),
  notes: many(notes),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [documents.notebookId],
    references: [notebooks.id],
  }),
}));

export const chatHistoryRelations = relations(chatHistory, ({ one, many }) => ({
  notebook: one(notebooks, {
    fields: [chatHistory.notebookId],
    references: [notebooks.id],
  }),
  linkedNotes: many(notes),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [notes.notebookId],
    references: [notebooks.id],
  }),
  linkedChat: one(chatHistory, {
    fields: [notes.linkedChatId],
    references: [chatHistory.id],
  }),
}));

// Insert schemas
export const insertNotebookSchema = createInsertSchema(notebooks).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertChatHistorySchema = createInsertSchema(chatHistory).omit({
  id: true,
  createdAt: true,
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertNotebook = z.infer<typeof insertNotebookSchema>;
export type Notebook = typeof notebooks.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertChatHistory = z.infer<typeof insertChatHistorySchema>;
export type ChatHistory = typeof chatHistory.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;
