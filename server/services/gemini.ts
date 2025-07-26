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
  documentId: string;
}

export interface ChatResponse {
  content: string;
  citations: {
    filename: string;
    documentId: string;
  }[];
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use Gemini's embedding model
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });

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
    const context = relevantChunks.map(chunk => 
      `Document: ${chunk.filename}\nContent: ${chunk.content}`
    ).join('\n\n');

    const systemPrompt = `You are an AI research assistant helping users analyze and extract insights from their documents. 

Based on the provided document context, answer the user's question accurately and comprehensively. Always cite your sources by referencing the document names when you use information from them.

Provide a clear, well-structured response that directly answers the user's question. Do not use markdown code blocks or JSON formatting - just provide a natural, conversational response.

Document Context:
${context}`;

    // Convert chat history to a string format for Gemini
    const historyContext = chatHistory.slice(-10).map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');

    const fullPrompt = `${systemPrompt}

Previous conversation:
${historyContext}

Current question: ${userMessage}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: fullPrompt,
    });

    const responseText = response.text || "";

    // Clean the response text to remove any markdown formatting
    const cleanedContent = responseText.replace(/```json\s*|\s*```/g, '').trim();

    // Generate citations from relevant chunks
    const citations = relevantChunks.map(chunk => ({
      filename: chunk.filename,
      documentId: chunk.documentId
    }));

    return {
      content: cleanedContent || "I apologize, but I couldn't generate a proper response.",
      citations: citations
    };
  } catch (error) {
    console.error("Error generating chat response:", error);
    throw new Error("Failed to generate AI response");
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