import {
  users,
  notebooks,
  documents,
  chatHistory,
  notes,
  type User,
  type UpsertUser,
  type Notebook,
  type InsertNotebook,
  type Document,
  type InsertDocument,
  type ChatHistory,
  type InsertChatHistory,
  type Note,
  type InsertNote,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Notebook operations
  getUserNotebooks(userId: string): Promise<Notebook[]>;
  getNotebook(id: string): Promise<Notebook | undefined>;
  createNotebook(notebook: InsertNotebook): Promise<Notebook>;
  updateNotebook(id: string, updates: Partial<InsertNotebook>): Promise<Notebook>;
  deleteNotebook(id: string): Promise<void>;
  
  // Document operations
  getNotebookDocuments(notebookId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  
  // Chat history operations
  getNotebookChatHistory(notebookId: string): Promise<ChatHistory[]>;
  createChatHistory(chatHistory: InsertChatHistory): Promise<ChatHistory>;
  clearNotebookChatHistory(notebookId: string): Promise<void>;
  
  // Notes operations
  getNotebookNotes(notebookId: string): Promise<Note[]>;
  getNote(id: string): Promise<Note | undefined>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: string, updates: Partial<InsertNote>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Notebook operations
  async getUserNotebooks(userId: string): Promise<Notebook[]> {
    return await db
      .select()
      .from(notebooks)
      .where(eq(notebooks.userId, userId))
      .orderBy(desc(notebooks.createdAt));
  }

  async getNotebook(id: string): Promise<Notebook | undefined> {
    const [notebook] = await db.select().from(notebooks).where(eq(notebooks.id, id));
    return notebook;
  }

  async createNotebook(notebook: InsertNotebook): Promise<Notebook> {
    const [newNotebook] = await db.insert(notebooks).values(notebook).returning();
    return newNotebook;
  }

  async updateNotebook(id: string, updates: Partial<InsertNotebook>): Promise<Notebook> {
    const [notebook] = await db
      .update(notebooks)
      .set(updates)
      .where(eq(notebooks.id, id))
      .returning();
    return notebook;
  }

  async deleteNotebook(id: string): Promise<void> {
    await db.delete(notebooks).where(eq(notebooks.id, id));
  }

  // Document operations
  async getNotebookDocuments(notebookId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.notebookId, notebookId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // Chat history operations
  async getNotebookChatHistory(notebookId: string): Promise<ChatHistory[]> {
    return await db
      .select()
      .from(chatHistory)
      .where(eq(chatHistory.notebookId, notebookId))
      .orderBy(chatHistory.createdAt);
  }

  async createChatHistory(chatHistoryData: InsertChatHistory): Promise<ChatHistory> {
    const [newChatHistory] = await db.insert(chatHistory).values(chatHistoryData).returning();
    return newChatHistory;
  }

  // Notes operations
  async getNotebookNotes(notebookId: string): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .where(eq(notes.notebookId, notebookId))
      .orderBy(desc(notes.createdAt));
  }

  async getNote(id: string): Promise<Note | undefined> {
    const [note] = await db.select().from(notes).where(eq(notes.id, id));
    return note;
  }

  async createNote(note: InsertNote): Promise<Note> {
    const [newNote] = await db.insert(notes).values(note).returning();
    return newNote;
  }

  async updateNote(id: string, updates: Partial<InsertNote>): Promise<Note> {
    const [note] = await db
      .update(notes)
      .set(updates)
      .where(eq(notes.id, id))
      .returning();
    return note;
  }

  async deleteNote(id: string): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  }

  // Clear chat history operations
  async clearNotebookChatHistory(notebookId: string): Promise<void> {
    await db.delete(chatHistory).where(eq(chatHistory.notebookId, notebookId));
  }
}

export const storage = new DatabaseStorage();
