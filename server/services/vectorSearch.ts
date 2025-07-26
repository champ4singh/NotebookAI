import { generateEmbedding } from './gemini.js';

interface DocumentVector {
  id: string;
  documentId: string;
  filename: string;
  content: string;
  embedding: number[];
}

// Simple in-memory vector store (in production, use FAISS or Pinecone)
class VectorStore {
  private vectors: DocumentVector[] = [];

  async addDocument(documentId: string, filename: string, chunks: string[]): Promise<void> {
    console.log(`Adding document ${documentId} with ${chunks.length} chunks to vector store`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const embedding = await generateEmbedding(chunk);
        
        this.vectors.push({
          id: `${documentId}_${i}`,
          documentId,
          filename,
          content: chunk,
          embedding
        });
        console.log(`Added chunk ${i} for document ${documentId}`);
      } catch (error) {
        console.error(`Error adding chunk ${i} for document ${documentId}:`, error);
      }
    }
    console.log(`Vector store now contains ${this.vectors.length} total vectors`);
  }

  async searchSimilar(query: string, topK: number = 5): Promise<{
    content: string;
    filename: string;
    documentId: string;
    similarity: number;
  }[]> {
    console.log(`Vector store search: ${this.vectors.length} vectors available`);
    if (this.vectors.length === 0) {
      console.log('No vectors in store, returning empty results');
      return [];
    }

    try {
      const queryEmbedding = await generateEmbedding(query);
      
      const similarities = this.vectors.map(vector => ({
        ...vector,
        similarity: cosineSimilarity(queryEmbedding, vector.embedding)
      }));

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map(({ content, filename, documentId, similarity }) => ({
          content,
          filename,
          documentId,
          similarity
        }));
    } catch (error) {
      console.error('Error searching vectors:', error);
      return [];
    }
  }

  removeDocument(documentId: string): void {
    this.vectors = this.vectors.filter(vector => vector.documentId !== documentId);
  }

  getDocumentCount(): number {
    const uniqueDocuments = new Set(this.vectors.map(v => v.documentId));
    return uniqueDocuments.size;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

export const vectorStore = new VectorStore();
