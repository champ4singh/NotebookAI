import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { processDocument, formatFileSize } from "./services/documentProcessor";
import { vectorStore } from "./services/vectorSearch";
import { vectorWorker } from "./services/vectorWorker";
import { generateChatResponse, generateDocumentSummary } from "./services/gemini";
import { formatAIContent } from "./services/contentFormatter";
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
    let filePath: string | null = null;
    try {
      const { notebookId } = req.params;
      const notebook = await storage.getNotebook(notebookId);
      
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      filePath = req.file.path;
      console.log(`Processing document: ${req.file.originalname} (${req.file.size} bytes)`);
      
      const { content, chunks, title } = await processDocument(req.file.path, req.file.originalname);
      console.log(`Document processed successfully: ${content.length} characters, ${chunks.length} chunks`);
      
      const documentData = {
        notebookId,
        filename: req.file.originalname,
        title,
        fileType: path.extname(req.file.originalname).toLowerCase(),
        content,
        size: req.file.size,
      };

      const document = await storage.createDocument(documentData);
      console.log(`Document saved to database: ${document.id}`);
      
      // Add to vector store using dedicated worker queue
      // This completely isolates vector operations from the main database connection
      vectorWorker.addJob({
        documentId: document.id,
        filename: document.filename,
        chunks,
        title
      }).catch(error => {
        console.error(`Failed to queue vector job for document ${document.id}:`, error);
      });

      // Clean up uploaded file
      await fs.unlink(req.file.path);
      filePath = null; // Mark as cleaned up

      res.json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      
      // Clean up uploaded file if it exists and wasn't cleaned up yet
      if (filePath) {
        try {
          await fs.unlink(filePath);
        } catch (unlinkError) {
          console.error("Error cleaning up uploaded file:", unlinkError);
        }
      }
      
      // Handle specific database errors
      if (error instanceof Error) {
        if (error.message.includes('terminating connection') || 
            error.message.includes('administrator command') ||
            error.message.includes('connection')) {
          return res.status(503).json({ 
            message: "Database connection issue. Please try uploading the document again." 
          });
        }
        return res.status(500).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to upload document" });
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
      await vectorStore.removeDocument(id);

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
      const { message, selectedDocuments } = req.body;
      
      const notebook = await storage.getNotebook(notebookId);
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      // Get relevant document chunks
      let relevantChunks = await vectorStore.searchSimilar(message, 5);
      console.log(`Found ${relevantChunks.length} relevant chunks for query: "${message}"`);
      console.log(`Selected documents: ${selectedDocuments ? selectedDocuments.join(', ') : 'none'}`);
      
      // If documents are selected, filter to only those documents
      if (selectedDocuments && selectedDocuments.length > 0) {
        if (relevantChunks.length > 0) {
          // Filter existing chunks to selected documents only
          relevantChunks = relevantChunks.filter(chunk => 
            selectedDocuments.includes(chunk.documentId)
          );
          console.log(`Filtered vector search to ${relevantChunks.length} chunks from selected documents`);
        }
        
        // If no chunks found or vector search failed, get the selected documents directly
        if (relevantChunks.length === 0) {
          console.log('No relevant chunks found in selected documents, fetching selected documents directly...');
          const allDocuments = await storage.getNotebookDocuments(notebookId);
          const selectedDocs = allDocuments.filter(doc => selectedDocuments.includes(doc.id));
          console.log(`Using ${selectedDocs.length} selected documents directly`);
          
          relevantChunks = selectedDocs.flatMap(doc => {
            // Split document into chunks for better citation
            const chunkSize = 1500;
            const chunks = [];
            for (let i = 0; i < doc.content.length; i += chunkSize) {
              chunks.push({
                content: doc.content.slice(i, i + chunkSize),
                filename: doc.filename,
                title: doc.title || undefined,
                documentId: doc.id,
                similarity: 1.0
              });
            }
            return chunks.slice(0, 5); // Limit to 5 chunks per document
          });
        }
      } else {
        // No specific documents selected, use all available
        if (relevantChunks.length === 0) {
          console.log('No relevant chunks found, fetching all notebook documents...');
          const documentCount = await vectorStore.getDocumentCount();
          console.log(`Vector store document count: ${documentCount}`);
          
          const allDocuments = await storage.getNotebookDocuments(notebookId);
          console.log(`Found ${allDocuments.length} total documents in notebook`);
          
          relevantChunks = allDocuments.flatMap(doc => {
            // Split document into chunks for better citation
            const chunkSize = 1500;
            const chunks = [];
            for (let i = 0; i < doc.content.length; i += chunkSize) {
              chunks.push({
                content: doc.content.slice(i, i + chunkSize),
                filename: doc.filename,
                title: doc.title || undefined,
                documentId: doc.id,
                similarity: 1.0
              });
            }
            return chunks.slice(0, 5); // Limit to 5 chunks per document
          });
        }
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

  // AI Content Generation route
  app.post('/api/notebooks/:notebookId/generate-ai-content', isAuthenticated, async (req: any, res) => {
    try {
      const { notebookId } = req.params;
      const { contentType, selectedDocuments } = req.body;
      
      const notebook = await storage.getNotebook(notebookId);
      if (!notebook || notebook.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Notebook not found" });
      }

      // Get documents for content generation - either selected documents or all documents
      let documents = await storage.getNotebookDocuments(notebookId);
      
      // If specific documents are selected, filter to only those
      if (selectedDocuments && selectedDocuments.length > 0) {
        documents = documents.filter(doc => selectedDocuments.includes(doc.id));
        console.log(`Using ${documents.length} selected documents for AI content generation: ${selectedDocuments.join(', ')}`);
      } else {
        console.log(`Using all ${documents.length} documents for AI content generation`);
      }
      
      if (documents.length === 0) {
        return res.status(400).json({ message: "No documents found in notebook" });
      }

      // Combine document content for AI processing
      const combinedContent = documents.map(doc => 
        `**${doc.filename}${doc.title ? ` (${doc.title})` : ''}**\n\n${doc.content}`
      ).join('\n\n---\n\n');

      // Generate appropriate prompt based on content type
      let prompt = '';
      let title = '';
      
      switch (contentType) {
        case 'study_guide':
          prompt = `Generate a comprehensive study guide from the provided documents. Format it with clear headings, bullet points, and proper structure for easy reading and studying.

Structure your response as follows:
# Study Guide

## Key Topics
- Topic 1: Brief description
- Topic 2: Brief description
- (etc.)

## Important Concepts
### Concept 1
- Definition and explanation
- Key points to remember

### Concept 2  
- Definition and explanation
- Key points to remember

## Summary Points
- Main takeaway 1
- Main takeaway 2
- (etc.)

Documents:
${combinedContent}`;
          title = 'Study Guide';
          break;
          
        case 'briefing_doc':
          prompt = `Write a professional briefing document from the provided documents. Format it for decision-makers with clear structure and actionable insights.

Structure your response as follows:
# Executive Briefing

## Executive Summary
- Key finding 1
- Key finding 2
- Main recommendation

## Key Insights
### Finding 1
- Details and implications
- Supporting evidence

### Finding 2
- Details and implications
- Supporting evidence

## Actionable Recommendations
1. Recommendation 1 with rationale
2. Recommendation 2 with rationale
3. Next steps

## Conclusion
Brief summary of most critical points.

Documents:
${combinedContent}`;
          title = 'Briefing Document';
          break;
          
        case 'faq':
          prompt = `Create a comprehensive FAQ section based on the provided documents. Format it with clear questions and detailed answers.

Structure your response as follows:
# Frequently Asked Questions

## General Questions

**Q: What is [main topic]?**
A: Detailed answer based on documents

**Q: How does [key concept] work?**
A: Step-by-step explanation

## Technical Questions

**Q: What are the requirements?**
A: List of requirements with details

**Q: What are common issues?**
A: Common problems and solutions

## Additional Questions

Include 3-5 more relevant questions that readers would likely have.

Documents:
${combinedContent}`;
          title = 'FAQ';
          break;
          
        case 'timeline':
          prompt = `Extract all events, dates, and milestones from the documents and create a chronological timeline. Format it clearly with dates and descriptions.

Structure your response as follows:
# Timeline

## [Date/Period 1]
- **Event**: Description of what happened
- **Significance**: Why this was important

## [Date/Period 2]  
- **Event**: Description of what happened
- **Significance**: Why this was important

## [Date/Period 3]
- **Event**: Description of what happened
- **Significance**: Why this was important

If exact dates aren't available, organize by sequence (Phase 1, Phase 2, etc.) or relative timing (Early Period, Mid Period, Recent Period).

Documents:
${combinedContent}`;
          title = 'Timeline';
          break;
          
        default:
          return res.status(400).json({ message: "Invalid content type" });
      }

      // Use generateChatResponse to create the AI content
      console.log(`Generating AI content for type: ${contentType}`);
      console.log(`Processing ${documents.length} documents with total content length: ${combinedContent.length} characters`);
      
      const { content: aiContent } = await generateChatResponse(
        prompt,
        documents.flatMap(doc => [{
          content: doc.content,
          filename: doc.filename,
          title: doc.title || undefined,
          documentId: doc.id,
          similarity: 1.0
        }]),
        []
      );
      
      console.log(`Generated AI content length: ${aiContent.length} characters`);

      // Format the AI content for better readability and professional appearance
      const formattedContent = formatAIContent(aiContent, contentType);
      console.log(`Formatted content length: ${formattedContent.length} characters`);

      // Create the note with AI-generated content
      const noteData = {
        notebookId,
        title,
        content: formattedContent,
        sourceType: 'ai_generated' as const,
        aiContentType: contentType,
        linkedChatId: null
      };

      const note = await storage.createNote(noteData);
      res.json({ ...note, contentType });
    } catch (error) {
      console.error("Error generating AI content:", error);
      res.status(500).json({ message: "Failed to generate AI content" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
