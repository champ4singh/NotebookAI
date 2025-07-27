import { pineconeService } from './pineconeService';

// Vector store interface that delegates to Pinecone
class VectorStore {
  private initialized = false;

  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await pineconeService.initializeIndex();
      this.initialized = true;
    }
  }

  async addDocument(documentId: string, filename: string, chunks: string[], title?: string): Promise<void> {
    await this.ensureInitialized();
    return pineconeService.addDocument(documentId, filename, chunks, title);
  }

  async searchSimilar(query: string, topK: number = 5): Promise<{
    content: string;
    filename: string;
    title?: string;
    documentId: string;
    similarity: number;
  }[]> {
    await this.ensureInitialized();
    const results = await pineconeService.searchSimilar(query, topK);
    console.log(`Vector store search: ${results.length} vectors found`);
    return results;
  }

  async removeDocument(documentId: string): Promise<void> {
    await this.ensureInitialized();
    return pineconeService.removeDocument(documentId);
  }

  async getDocumentCount(): Promise<number> {
    await this.ensureInitialized();
    return pineconeService.getDocumentCount();
  }
}

export const vectorStore = new VectorStore();
