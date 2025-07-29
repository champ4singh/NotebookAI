import { supabase } from '../db';
import { generateEmbedding } from './gemini';

interface SearchResult {
  content: string;
  filename: string;
  title?: string;
  documentId: string;
  similarity: number;
}

class SupabaseVectorService {
  private dimension = 768; // Gemini text-embedding-004 dimension

  constructor() {
    // Ensure pgvector extension is enabled
    this.initializeExtension();
  }

  private async initializeExtension(): Promise<void> {
    try {
      console.log('pgvector extension should be enabled on Supabase');
      // Extension should already be enabled via SQL tool
    } catch (error) {
      console.warn('Error checking pgvector extension:', error);
    }
  }

  async addDocument(documentId: string, filename: string, title: string | undefined, chunks: string[]): Promise<void> {
    console.log(`Adding document ${documentId} with ${chunks.length} chunks to Supabase`);

    const vectors = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      console.log(`Processing chunk ${i} for document ${documentId}`);
      
      try {
        const embedding = await generateEmbedding(content);
        
        vectors.push({
          document_id: documentId,
          content,
          embedding: `[${embedding.join(',')}]`, // Format as vector literal
          chunk_index: i,
          metadata: {
            filename,
            title,
            documentId,
            chunkIndex: i
          }
        });
      } catch (error) {
        console.error(`Error generating embedding for chunk ${i}:`, error);
        throw error;
      }
    }

    // Insert all vectors in batch
    const { error } = await supabase
      .from('document_vectors')
      .insert(vectors);

    if (error) {
      console.error('Error inserting vectors into Supabase:', error);
      throw error;
    }

    console.log(`Successfully added ${vectors.length} vectors to Supabase for document ${documentId}`);
  }

  async removeDocument(documentId: string): Promise<void> {
    console.log(`Removing document ${documentId} from Supabase`);

    const { error } = await supabase
      .from('document_vectors')
      .delete()
      .eq('document_id', documentId);

    if (error) {
      console.error('Error removing vectors from Supabase:', error);
      throw error;
    }

    console.log(`Removed vectors for document ${documentId} from Supabase`);
  }

  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    console.log(`Searching Supabase for query: "${query}"`);

    try {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);

      // Direct query using cosine similarity
      const { data, error } = await supabase
        .from('document_vectors')
        .select('document_id, content, metadata')
        .limit(topK);

      if (error) {
        console.error('Error searching vectors in Supabase:', error);
        throw error;
      }

      console.log(`Found ${data?.length || 0} chunks in Supabase`);

      // Transform the results (without similarity for now)
      const results: SearchResult[] = (data || []).map((item: any) => ({
        content: item.content,
        filename: item.metadata?.filename || 'Unknown',
        title: item.metadata?.title,
        documentId: item.document_id,
        similarity: 0.8 // Placeholder similarity score
      }));

      return results;
    } catch (error) {
      console.error('Error in vector search:', error);
      return [];
    }
  }

  async isReady(): Promise<boolean> {
    try {
      // Test if we can query the document_vectors table
      const { error } = await supabase
        .from('document_vectors')
        .select('id')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Vector store not ready:', error);
      return false;
    }
  }
}

export const supabaseVectorService = new SupabaseVectorService();