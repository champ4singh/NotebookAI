import { pineconeService } from './pineconeService';

// Vector store interface that delegates to Pinecone
class VectorStore {
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.initialize();
    return this.initializationPromise;
  }
  
  private async initialize(): Promise<void> {
    try {
      await pineconeService.initializeIndex();
      this.initialized = true;
      console.log('Vector store initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector store:', error);
      this.initializationPromise = null; // Allow retry
      throw error;
    }
  }

  async addDocument(documentId: string, filename: string, chunks: string[], title?: string): Promise<void> {
    try {
      await this.ensureInitialized();
      
      // Add timeout to prevent hanging operations
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Vector store operation timed out')), 30000); // 30 second timeout
      });
      
      const addPromise = pineconeService.addDocument(documentId, filename, chunks, title);
      
      return await Promise.race([addPromise, timeoutPromise]);
    } catch (error) {
      console.error('Error adding document to vector store:', error);
      // Don't throw - allow the application to continue without vector storage
      console.log('Continuing without vector storage for this document');
    }
  }

  async searchSimilar(query: string, topK: number = 5): Promise<{
    content: string;
    filename: string;
    title?: string;
    documentId: string;
    similarity: number;
  }[]> {
    try {
      await this.ensureInitialized();
      const results = await pineconeService.searchSimilar(query, topK);
      console.log(`Vector store search: ${results.length} vectors found`);
      return results;
    } catch (error) {
      console.error('Error searching vector store:', error);
      console.log('No vectors in store, returning empty results');
      return [];
    }
  }

  async removeDocument(documentId: string): Promise<void> {
    try {
      await this.ensureInitialized();
      return await pineconeService.removeDocument(documentId);
    } catch (error) {
      console.error('Error removing document from vector store:', error);
      // Don't throw - allow the application to continue
    }
  }

  async getDocumentCount(): Promise<number> {
    try {
      await this.ensureInitialized();
      return await pineconeService.getDocumentCount();
    } catch (error) {
      console.error('Error getting document count from vector store:', error);
      return 0;
    }
  }
}

export const vectorStore = new VectorStore();
