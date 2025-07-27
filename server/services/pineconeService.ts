import { Pinecone } from '@pinecone-database/pinecone';
import { generateEmbedding } from './gemini';

interface PineconeVector {
  id: string;
  values: number[];
  metadata: {
    documentId: string;
    filename: string;
    title?: string;
    content: string;
    chunkIndex: number;
  };
}

interface SearchResult {
  content: string;
  filename: string;
  title?: string;
  documentId: string;
  similarity: number;
}

class PineconeService {
  private pinecone: Pinecone;
  private indexName = 'notebookai-documents';
  private dimension = 768; // Gemini text-embedding-004 dimension

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }

  async initializeIndex(): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        console.log(`Checking if Pinecone index exists... (attempt ${attempt + 1}/${maxRetries})`);
        const indexList = await this.pinecone.listIndexes();
        console.log('Available indexes:', indexList.indexes?.map(i => i.name).join(', ') || 'none');
        
        const targetIndex = indexList.indexes?.find(index => index.name === this.indexName);

        if (!targetIndex) {
          console.log(`Creating Pinecone index: ${this.indexName}`);
          await this.pinecone.createIndex({
            name: this.indexName,
            dimension: this.dimension,
            metric: 'cosine',
            spec: {
              serverless: {
                cloud: 'aws',
                region: 'us-east-1'
              }
            }
          });
          
          // Wait for index to be ready
          console.log('Waiting for index to be ready...');
          await this.waitForIndexReady();
        } else {
          console.log(`Pinecone index ${this.indexName} already exists`);
          // Verify the existing index has the correct dimensions
          if (targetIndex.dimension !== this.dimension) {
            console.warn(`Warning: Existing index ${this.indexName} has ${targetIndex.dimension} dimensions, expected ${this.dimension}`);
          }
        }
        return; // Success, exit retry loop
      } catch (error: any) {
        attempt++;
        console.error(`Error initializing Pinecone index (attempt ${attempt}):`, error);
        
        // Check if this is a quota limit error
        if (error.message?.includes('max serverless indexes') || 
            error.message?.includes('FORBIDDEN') || 
            error.message?.includes('quota') ||
            error.message?.includes('limit')) {
          
          const indexList = await this.pinecone.listIndexes();
          const existingIndexes = indexList.indexes || [];
          
          const errorMessage = `
═══════════════════════════════════════════════════════════════
❌ PINECONE INDEX LIMIT REACHED
═══════════════════════════════════════════════════════════════

Cannot create the required index "${this.indexName}" because you've reached 
your Pinecone account's index limit.

Current indexes in your account:
${existingIndexes.map(idx => `  • ${idx.name} (${idx.dimension}d, ${idx.metric})`).join('\n')}

SOLUTION: Please delete one or more unwanted indexes from your Pinecone 
dashboard to make room for the "${this.indexName}" index.

Visit: https://app.pinecone.io/

═══════════════════════════════════════════════════════════════
          `.trim();
          
          console.error(errorMessage);
          throw new Error(`Pinecone index limit reached. Please delete unwanted indexes to create "${this.indexName}". Current indexes: ${existingIndexes.map(i => i.name).join(', ')}`);
        }
        
        if (attempt >= maxRetries) {
          console.error('Failed to initialize Pinecone after maximum retries');
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  private async waitForIndexReady(): Promise<void> {
    const maxRetries = 60; // 5 minutes max
    let retries = 0;

    while (retries < maxRetries) {
      try {
        const indexStats = await this.pinecone.index(this.indexName).describeIndexStats();
        if (indexStats) {
          console.log('Pinecone index is ready');
          return;
        }
      } catch (error) {
        // Index not ready yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      retries++;
    }
    
    throw new Error('Timeout waiting for Pinecone index to be ready');
  }

  async addDocument(documentId: string, filename: string, chunks: string[], title?: string): Promise<void> {
    try {
      console.log(`Adding document ${documentId} with ${chunks.length} chunks to Pinecone`);
      
      const vectors: PineconeVector[] = [];
      
      // Process chunks in smaller batches with delays to avoid timeouts
      const batchSize = 3; // Reduce batch size further
      for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
        const batch = chunks.slice(batchStart, Math.min(batchStart + batchSize, chunks.length));
        
        for (let i = 0; i < batch.length; i++) {
          const chunkIndex = batchStart + i;
          const chunk = batch[i];
          try {
            console.log(`Processing chunk ${chunkIndex} for document ${documentId}`);
            const embedding = await generateEmbedding(chunk);
            
            vectors.push({
              id: `${documentId}_${chunkIndex}`,
              values: embedding,
              metadata: {
                documentId,
                filename,
                title,
                content: chunk,
                chunkIndex: chunkIndex
              }
            });
            
            // Small delay between chunks to prevent overwhelming the system
            if (chunkIndex < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          } catch (error) {
            console.error(`Error generating embedding for chunk ${chunkIndex} of document ${documentId}:`, error);
          }
        }
        
        // Longer delay between batches
        if (batchStart + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (vectors.length > 0) {
        const index = this.pinecone.index(this.indexName);
        await index.upsert(vectors);
        console.log(`Successfully added ${vectors.length} vectors to Pinecone for document ${documentId}`);
      }
    } catch (error) {
      console.error(`Error adding document ${documentId} to Pinecone:`, error);
      throw error;
    }
  }

  async searchSimilar(query: string, topK: number = 5): Promise<SearchResult[]> {
    try {
      console.log(`Searching Pinecone for query: "${query}"`);
      
      const queryEmbedding = await generateEmbedding(query);
      const index = this.pinecone.index(this.indexName);
      
      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        includeValues: false
      });

      const results: SearchResult[] = [];
      
      if (queryResponse.matches) {
        for (const match of queryResponse.matches) {
          if (match.metadata && match.score !== undefined) {
            results.push({
              content: match.metadata.content as string,
              filename: match.metadata.filename as string,
              title: match.metadata.title as string | undefined,
              documentId: match.metadata.documentId as string,
              similarity: match.score
            });
          }
        }
      }

      console.log(`Found ${results.length} similar chunks in Pinecone`);
      return results;
    } catch (error) {
      console.error('Error searching Pinecone:', error);
      return [];
    }
  }

  async removeDocument(documentId: string): Promise<void> {
    try {
      console.log(`Removing document ${documentId} from Pinecone`);
      
      const index = this.pinecone.index(this.indexName);
      
      // First, find all vectors for this document
      const queryResponse = await index.query({
        vector: new Array(this.dimension).fill(0), // Dummy vector
        topK: 10000, // Get all matches
        includeMetadata: true,
        includeValues: false,
        filter: {
          documentId: { $eq: documentId }
        }
      });

      if (queryResponse.matches && queryResponse.matches.length > 0) {
        const idsToDelete = queryResponse.matches.map(match => match.id);
        await index.deleteMany(idsToDelete);
        console.log(`Removed ${idsToDelete.length} vectors for document ${documentId} from Pinecone`);
      } else {
        console.log(`No vectors found for document ${documentId} in Pinecone`);
      }
    } catch (error) {
      console.error(`Error removing document ${documentId} from Pinecone:`, error);
      throw error;
    }
  }

  async getDocumentCount(): Promise<number> {
    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      return stats.totalRecordCount || 0;
    } catch (error) {
      console.error('Error getting Pinecone document count:', error);
      return 0;
    }
  }

  async deleteIndex(): Promise<void> {
    try {
      console.log(`Deleting Pinecone index: ${this.indexName}`);
      await this.pinecone.deleteIndex(this.indexName);
      console.log('Pinecone index deleted successfully');
    } catch (error) {
      console.error('Error deleting Pinecone index:', error);
      throw error;
    }
  }
}

export const pineconeService = new PineconeService();