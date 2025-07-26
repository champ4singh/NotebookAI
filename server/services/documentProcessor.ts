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

    const chunks = chunkText(content);
    
    return {
      content,
      chunks
    };
  } catch (error) {
    console.error(`Error processing document ${filename}:`, error);
    throw new Error(`Failed to process document: ${filename}`);
  }
}

async function processPDF(filePath: string): Promise<string> {
  // Note: In a real implementation, you would use a PDF parsing library like pdf-parse
  // For now, we'll return a placeholder that indicates PDF processing is needed
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error("PDF processing requires additional libraries. Please upload text or markdown files for now.");
  }
}

async function processDocx(filePath: string): Promise<string> {
  // Note: In a real implementation, you would use a DOCX parsing library like mammoth
  // For now, we'll return a placeholder that indicates DOCX processing is needed
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    throw new Error("DOCX processing requires additional libraries. Please upload text or markdown files for now.");
  }
}

function chunkText(text: string, chunkSize: number = 512): string[] {
  const words = text.split(/\s+/);
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
