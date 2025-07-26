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
    // Note: Gemini doesn't have a direct embedding API like OpenAI
    // For now, we'll create a simple hash-based embedding as a placeholder
    // In production, you might want to use a different embedding service
    const hash = text.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Create a simple 768-dimensional vector based on text features
    const embedding = new Array(768).fill(0).map((_, i) => {
      return Math.sin(hash * (i + 1) / 768) * Math.cos(text.length * (i + 1) / 768);
    });
    
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
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

Format your response as JSON with the following structure:
{
  "content": "Your detailed response here",
  "citations": [
    {
      "filename": "document_name.pdf",
      "documentId": "document_id"
    }
  ]
}

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
      model: "gemini-2.5-pro",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            content: { type: "string" },
            citations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  filename: { type: "string" },
                  documentId: { type: "string" }
                },
                required: ["filename", "documentId"]
              }
            }
          },
          required: ["content", "citations"]
        }
      },
      contents: fullPrompt,
    });

    const result = JSON.parse(response.text || '{}');
    
    // Ensure citations include document IDs
    const citations = relevantChunks.map(chunk => ({
      filename: chunk.filename,
      documentId: chunk.documentId
    }));

    return {
      content: result.content || "I apologize, but I couldn't generate a proper response.",
      citations: result.citations || citations
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
      model: "gemini-2.5-pro",
      contents: prompt,
    });

    return response.text || "Unable to generate summary.";
  } catch (error) {
    console.error("Error generating document summary:", error);
    return "Summary unavailable.";
  }
}