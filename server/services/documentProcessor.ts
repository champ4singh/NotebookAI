import { promises as fs } from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import pdf2pic from 'pdf2pic';

export interface ProcessedDocument {
  content: string;
  chunks: string[];
  title: string;
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
    const title = extractDocumentTitle(sanitizedContent, filename);
    
    return {
      content: sanitizedContent,
      chunks,
      title
    };
  } catch (error) {
    console.error(`Error processing document ${filename}:`, error);
    throw new Error(`Failed to process document: ${filename}`);
  }
}

async function processPDF(filePath: string): Promise<string> {
  try {
    console.log(`Processing PDF: ${filePath}`);
    const buffer = await fs.readFile(filePath);
    
    // Step 1: Try text extraction with dynamic pdf-parse import
    let extractedText = '';
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text || '';
      console.log(`PDF text extraction: ${extractedText.length} characters extracted`);
    } catch (parseError) {
      console.log('PDF text extraction failed, will use OCR:', parseError instanceof Error ? parseError.message : 'Unknown error');
    }
    
    // Step 2: If no text extracted or very little text, use OCR
    if (!extractedText || extractedText.trim().length < 50) {
      console.log('Performing OCR on PDF pages...');
      extractedText = await performPDFOCR(filePath, buffer);
    }
    
    // Step 3: Clean and validate extracted text
    const cleanedText = extractedText
      .replace(/\0/g, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();
    
    if (!cleanedText || cleanedText.length < 10) {
      throw new Error('No readable text could be extracted from the PDF');
    }
    
    console.log(`Final extracted text: ${cleanedText.length} characters`);
    return cleanedText;
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw new Error(`Failed to process PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function performPDFOCR(filePath: string, buffer: Buffer): Promise<string> {
  try {
    // Convert PDF pages to images
    const convert = pdf2pic.fromBuffer(buffer, {
      density: 200,           // DPI for better quality
      saveFilename: "page",
      savePath: "/tmp",
      format: "png",
      width: 1200,           // Higher resolution for better OCR
      height: 1600
    });
    
    let allText = '';
    const maxPages = 10; // Limit to first 10 pages for performance
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        console.log(`Processing page ${pageNum} with OCR...`);
        
        // Convert PDF page to image
        const result = await convert(pageNum, { responseType: "buffer" });
        
        if (!result || !result.buffer) {
          console.log(`No image data for page ${pageNum}, stopping OCR`);
          break;
        }
        
        // Perform OCR on the image
        const ocrResult = await Tesseract.recognize(
          result.buffer,
          'eng',
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                console.log(`OCR progress page ${pageNum}: ${Math.round(m.progress * 100)}%`);
              }
            }
          }
        );
        
        const pageText = ocrResult.data.text.trim();
        if (pageText) {
          allText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
        }
        
      } catch (pageError) {
        console.error(`Error processing page ${pageNum}:`, pageError);
        // Continue with next page
      }
    }
    
    return allText.trim();
    
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw new Error('OCR text extraction failed');
  }
}

async function processDocx(filePath: string): Promise<string> {
  try {
    // Read DOCX as buffer
    const buffer = await fs.readFile(filePath);
    
    // Extract text using mammoth
    const result = await mammoth.extractRawText({ buffer });
    
    if (!result.value || result.value.trim().length === 0) {
      // If no text extracted, return metadata
      const stats = await fs.stat(filePath);
      return `DOCX Document (${Math.round(stats.size / 1024)}KB)
      
This DOCX file appears to contain mostly images or non-text content. No readable text could be extracted for analysis.`;
    }
    
    // Return the extracted text
    return result.value;
  } catch (error) {
    console.error("Error processing DOCX:", error);
    throw new Error("Failed to extract text from DOCX file");
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

function extractDocumentTitle(content: string, filename: string): string {
  // Try to extract title from content - look for common title patterns
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Check first few lines for title patterns
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i];
    
    // Skip very short or very long lines
    if (line.length < 5 || line.length > 150) continue;
    
    // Skip lines that look like headers, dates, or metadata
    if (line.match(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/) || 
        line.match(/^(abstract|introduction|conclusion|references)$/i) ||
        line.match(/^(page \d+|chapter \d+)$/i)) {
      continue;
    }
    
    // Look for markdown headers
    const markdownMatch = line.match(/^#+\s*(.+)$/);
    if (markdownMatch) {
      const title = markdownMatch[1].trim();
      if (title.length >= 10 && title.length <= 100) {
        return title;
      }
    }
    
    // If it's a reasonably sized line and contains mostly letters, it might be a title
    if (line.length >= 10 && line.length <= 100 && 
        /^[A-Z]/.test(line) && 
        (line.match(/[a-zA-Z]/g) || []).length / line.length > 0.7) {
      return line;
    }
  }
  
  // Fallback: create title from filename
  return filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
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
