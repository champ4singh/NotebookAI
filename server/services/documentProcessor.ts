import { promises as fs } from 'fs';
import path from 'path';

export interface ProcessedDocument {
  content: string;
  chunks: string[];
}

export async function processDocument(filePath: string, filename: string): Promise<ProcessedDocument> {
  const ext = path.extname(filename).toLowerCase();
  
  try {
    let content: string;
    
    switch (ext) {
      case '.txt':
      case '.md':
        content = await fs.readFile(filePath, 'utf-8');
        break;
      case '.pdf':
        content = await processPDF(filePath);
        break;
      case '.docx':
        content = await processDocx(filePath);
        break;
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }

    // Sanitize content to remove null bytes and other problematic characters
    const sanitizedContent = content.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    const chunks = chunkText(sanitizedContent);
    
    return {
      content: sanitizedContent,
      chunks
    };
  } catch (error) {
    console.error(`Error processing document ${filename}:`, error);
    throw new Error(`Failed to process document: ${filename}`);
  }
}

async function processPDF(filePath: string): Promise<string> {
  try {
    // Read as buffer first to handle binary data
    const buffer = await fs.readFile(filePath);
    
    // For now, we'll extract basic metadata and return a placeholder
    // In production, you'd use pdf-parse or similar library
    const stats = await fs.stat(filePath);
    return `PDF Document (${Math.round(stats.size / 1024)}KB)
    
This is a PDF file that has been uploaded successfully. 
PDF text extraction is not yet implemented, but the file has been stored and can be referenced in conversations.

To fully extract text content from PDFs, a PDF parsing library like pdf-parse would need to be installed.`;
  } catch (error) {
    throw new Error("Failed to process PDF file");
  }
}

async function processDocx(filePath: string): Promise<string> {
  try {
    // Read as buffer first to handle binary data
    const buffer = await fs.readFile(filePath);
    
    // For now, we'll extract basic metadata and return a placeholder
    // In production, you'd use mammoth or similar library
    const stats = await fs.stat(filePath);
    return `DOCX Document (${Math.round(stats.size / 1024)}KB)
    
This is a DOCX file that has been uploaded successfully. 
DOCX text extraction is not yet implemented, but the file has been stored and can be referenced in conversations.

To fully extract text content from DOCX files, a document parsing library like mammoth would need to be installed.`;
  } catch (error) {
    throw new Error("Failed to process DOCX file");
  }
}

function chunkText(text: string, chunkSize: number = 512): string[] {
  // Remove null bytes and other problematic characters
  const sanitizedText = text.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  const words = sanitizedText.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk);
    }
  }
  
  return chunks;
}

export function getFileIcon(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  switch (ext) {
    case '.pdf':
      return 'fas fa-file-pdf';
    case '.docx':
      return 'fas fa-file-word';
    case '.txt':
      return 'fas fa-file-alt';
    case '.md':
      return 'fab fa-markdown';
    default:
      return 'fas fa-file';
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
