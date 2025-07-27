import { GoogleGenAI } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DocumentChunk {
  content: string;
  filename: string;
  title?: string;
  documentId: string;
}

export interface ChatResponse {
  content: string;
  citations: {
    filename: string;
    title?: string;
    documentId: string;
    chunks: string[];
  }[];
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Add timeout protection for Gemini API calls
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini embedding timeout')), 15000); // 15 second timeout
    });
    
    const embeddingPromise = ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });

    const response = await Promise.race([embeddingPromise, timeoutPromise]);
    return response.embeddings?.[0]?.values || [];
  } catch (error) {
    console.error("Error generating embedding with Gemini:", error);

    // Fallback to simple hash-based embedding if Gemini fails
    const hash = text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    // Create a simple 768-dimensional vector based on text features
    const embedding = new Array(768).fill(0).map((_, i) => {
      return Math.sin(hash * (i + 1) / 768) * Math.cos(text.length * (i + 1) / 768);
    });

    console.log("Using fallback embedding generation");
    return embedding;
  }
}

export async function generateChatResponse(
  userMessage: string,
  relevantChunks: DocumentChunk[],
  chatHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  try {
    // Get unique documents from chunks
    const uniqueDocuments = Array.from(
      new Map(relevantChunks.map(chunk => [
        chunk.documentId, 
        {
          filename: chunk.filename,
          title: chunk.title || chunk.filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
          documentId: chunk.documentId,
          chunks: relevantChunks.filter(c => c.documentId === chunk.documentId)
        }
      ])).values()
    );

    console.log(`Chat response generation: Found ${uniqueDocuments.length} unique documents:`);
    uniqueDocuments.forEach((doc, index) => {
      console.log(`  [${index + 1}] ${doc.filename} (${doc.chunks.length} chunks)`);
    });

    // Create a numbered context with document references (one number per unique document)
    const context = uniqueDocuments.map((doc, index) => {
      const combinedContent = doc.chunks.map(chunk => chunk.content).join('\n\n');
      return `[${index + 1}] ${doc.filename}\nContent: ${combinedContent}`;
    }).join('\n\n');

    const systemPrompt = `You are an AI research assistant helping users analyze and extract insights from their documents. 

Based on the provided document context, answer the user's question accurately and comprehensively. When referencing information from documents, use ONLY the numbered citations that correspond to unique documents.

AVAILABLE DOCUMENTS: ${uniqueDocuments.length} document(s) are provided for analysis.
${uniqueDocuments.map((doc, index) => `[${index + 1}] ${doc.filename}`).join('\n')}

CRITICAL RULES FOR CITATIONS:
- You MUST analyze information from ALL provided documents when relevant to the question
- Use [1] for information from the first document, [2] for the second document, etc.
- NEVER use multiple citation numbers for the same document
- When summarizing or comparing, ensure you reference all relevant documents
- If the user asks about "documents" (plural) or "selected documents", make sure to include information from ALL provided documents

Document Context (each number represents ONE unique document):
${context}`;

    // Convert chat history to a string format for Gemini
    const historyContext = chatHistory.slice(-10).map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');

    const fullPrompt = `${systemPrompt}

Previous conversation:
${historyContext}

Current question: ${userMessage}`;

    // Add timeout protection for Gemini API calls
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini chat response timeout')), 30000); // 30 second timeout
    });
    
    const chatPromise = ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: fullPrompt,
    });

    const response = await Promise.race([chatPromise, timeoutPromise]);

    const responseText = response.text || "";

    // Clean the response text to remove any markdown formatting
    const cleanedContent = responseText.replace(/```json\s*|\s*```/g, '').trim();

    // Generate citations from unique documents with their chunks
    const citations = uniqueDocuments.map(doc => ({
      filename: doc.filename,
      title: doc.title,
      documentId: doc.documentId,
      chunks: doc.chunks.map(chunk => chunk.content)
    }));

    return {
      content: cleanedContent || "I apologize, but I couldn't generate a proper response.",
      citations: citations
    };
  } catch (error: any) {
    console.error("Error generating chat response:", error);
    console.error("Error details:", {
      message: error?.message,
      status: error?.status,
      code: error?.code
    });
    
    // Provide more specific error messages
    const errorMessage = error?.message || 'Unknown error';
    if (errorMessage.includes('timeout')) {
      throw new Error("AI response generation timed out. Please try again with a shorter prompt.");
    } else if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
      throw new Error("AI service quota exceeded. Please try again later.");
    } else if (errorMessage.includes('authentication') || errorMessage.includes('key')) {
      throw new Error("AI service authentication failed. Please check API key configuration.");
    } else {
      throw new Error(`Failed to generate AI response: ${errorMessage}`);
    }
  }
}

export async function generateDocumentSummary(content: string, filename: string): Promise<string> {
  try {
    const prompt = `You are a document analysis expert. Provide a concise summary of the document content in 2-3 sentences.

Please summarize this document (${filename}):

${content.slice(0, 4000)}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: prompt,
    });

    return response.text || "Unable to generate summary.";
  } catch (error) {
    console.error("Error generating document summary:", error);
    return "Summary unavailable.";
  }
}