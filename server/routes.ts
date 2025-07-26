import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { processDocument, formatFileSize } from "./services/documentProcessor";
import { vectorStore } from "./services/vectorSearch";
import { generateChatResponse, generateDocumentSummary } from "./services/gemini";
import { 
  insertNotebookSchema, 
  insertDocumentSchema, 
  insertChatHistorySchema, 
  insertNoteSchema 
} from "@shared/schema";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, TXT, and MD files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Notebook routes
  app.get('/api/notebooks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notebooks = await storage.getUserNotebooks(userId);
      res.json(notebooks);
    } catch (error) {
      console.error("Error fetching notebooks:", error);
      res.status(500).json({ message: "Failed to fetch notebooks" });
    }
  });

  app.post('/api/notebooks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const notebookData = insertNotebookSchema.parse({
        ...req.body,
        userId
      });
      
      const notebook = await storage.createNotebook(notebookData);
      res.json(notebook);
    } catch (error) {
      console.error("Error creating notebook:", error);
      res.status(500).json({ message: "Failed to create notebook" });
    }
  });

  app.get('/api/notebooks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notebook = await storage.getNotebook(id);
      
      if (!notebook) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      // Check if user owns the notebook
      if (notebook.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(notebook);
    } catch (error) {
      console.error("Error fetching notebook:", error);
      res.status(500).json({ message: "Failed to fetch notebook" });
    }
  });

  app.put('/api/notebooks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notebook = await storage.getNotebook(id);
      
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      const updates = insertNotebookSchema.partial().parse(req.body);
      const updatedNotebook = await storage.updateNotebook(id, updates);
      res.json(updatedNotebook);
    } catch (error) {
      console.error("Error updating notebook:", error);
      res.status(500).json({ message: "Failed to update notebook" });
    }
  });

  app.delete('/api/notebooks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const notebook = await storage.getNotebook(id);
      
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      await storage.deleteNotebook(id);
      res.json({ message: "Notebook deleted successfully" });
    } catch (error) {
      console.error("Error deleting notebook:", error);
      res.status(500).json({ message: "Failed to delete notebook" });
    }
  });

  // Document routes
  app.get('/api/notebooks/:notebookId/documents', isAuthenticated, async (req: any, res) => {
    try {
      const { notebookId } = req.params;
      const notebook = await storage.getNotebook(notebookId);
      
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      const documents = await storage.getNotebookDocuments(notebookId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post('/api/notebooks/:notebookId/documents', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const { notebookId } = req.params;
      const notebook = await storage.getNotebook(notebookId);
      
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { content, chunks } = await processDocument(req.file.path, req.file.originalname);
      
      const documentData = {
        notebookId,
        filename: req.file.originalname,
        fileType: path.extname(req.file.originalname).toLowerCase(),
        content,
        size: req.file.size,
      };

      const document = await storage.createDocument(documentData);
      
      // Add to vector store for semantic search
      await vectorStore.addDocument(document.id, document.filename, chunks);

      // Clean up uploaded file
      await fs.unlink(req.file.path);

      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to upload document" });
    }
  });

  app.delete('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getDocument(id);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const notebook = await storage.getNotebook(document.notebookId);
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteDocument(id);
      vectorStore.removeDocument(id);

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Chat routes
  app.get('/api/notebooks/:notebookId/chat', isAuthenticated, async (req: any, res) => {
    try {
      const { notebookId } = req.params;
      const notebook = await storage.getNotebook(notebookId);
      
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      const chatHistory = await storage.getNotebookChatHistory(notebookId);
      res.json(chatHistory);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  app.delete('/api/notebooks/:notebookId/chat', isAuthenticated, async (req: any, res) => {
    try {
      const { notebookId } = req.params;
      
      const notebook = await storage.getNotebook(notebookId);
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      await storage.clearNotebookChatHistory(notebookId);
      res.json({ message: "Chat history cleared successfully" });
    } catch (error) {
      console.error("Error clearing chat history:", error);
      res.status(500).json({ message: "Failed to clear chat history" });
    }
  });

  app.post('/api/notebooks/:notebookId/chat', isAuthenticated, async (req: any, res) => {
    try {
      const { notebookId } = req.params;
      const { message } = req.body;
      
      const notebook = await storage.getNotebook(notebookId);
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      // Get relevant document chunks
      let relevantChunks = await vectorStore.searchSimilar(message, 5);
      console.log(`Found ${relevantChunks.length} relevant chunks for query: "${message}"`);
      
      // If no relevant chunks found, get all documents from the notebook
      if (relevantChunks.length === 0) {
        console.log('No relevant chunks found, fetching all notebook documents...');
        console.log(`Vector store document count: ${vectorStore.getDocumentCount()}`);
        
        const documents = await storage.getNotebookDocuments(notebookId);
        console.log(`Found ${documents.length} documents in notebook`);
        
        // Convert documents to chunks format for AI processing
        relevantChunks = documents.map(doc => ({
          content: doc.content.slice(0, 2000), // Limit content to avoid token limits
          filename: doc.filename,
          documentId: doc.id,
          similarity: 1.0 // Set high similarity since we're directly accessing the documents
        }));
      }
      
      // Get recent chat history for context
      const recentChatHistory = await storage.getNotebookChatHistory(notebookId);
      const chatMessages = recentChatHistory.slice(-10).flatMap(chat => [
        { role: 'user' as const, content: chat.userPrompt },
        { role: 'assistant' as const, content: chat.aiResponse }
      ]);

      // Generate AI response
      const { content: aiResponse, citations } = await generateChatResponse(
        message,
        relevantChunks,
        chatMessages
      );

      // Save to chat history
      const chatHistoryData = {
        notebookId,
        userPrompt: message,
        aiResponse,
        metadata: { citations }
      };

      const chatEntry = await storage.createChatHistory(chatHistoryData);
      res.json(chatEntry);
    } catch (error) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Notes routes
  app.get('/api/notebooks/:notebookId/notes', isAuthenticated, async (req: any, res) => {
    try {
      const { notebookId } = req.params;
      const notebook = await storage.getNotebook(notebookId);
      
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      const notes = await storage.getNotebookNotes(notebookId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post('/api/notebooks/:notebookId/notes', isAuthenticated, async (req: any, res) => {
    try {
      const { notebookId } = req.params;
      const notebook = await storage.getNotebook(notebookId);
      
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      const noteData = insertNoteSchema.parse({
        ...req.body,
        notebookId
      });

      const note = await storage.createNote(noteData);
      res.json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.put('/api/notes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const note = await storage.getNote(id);
      
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      const notebook = await storage.getNotebook(note.notebookId);
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updates = insertNoteSchema.partial().parse(req.body);
      const updatedNote = await storage.updateNote(id, updates);
      res.json(updatedNote);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete('/api/notes/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const note = await storage.getNote(id);
      
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      const notebook = await storage.getNotebook(note.notebookId);
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteNote(id);
      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
