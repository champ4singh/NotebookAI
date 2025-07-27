// Dedicated worker for handling vector store operations independently
// This prevents database connection issues during long-running vector operations

import { vectorStore } from './vectorSearch';

interface VectorJob {
  documentId: string;
  filename: string;
  chunks: string[];
  title?: string;
}

class VectorWorker {
  private jobQueue: VectorJob[] = [];
  private processing = false;

  async addJob(job: VectorJob): Promise<void> {
    this.jobQueue.push(job);
    console.log(`Queued vector job for document ${job.documentId}`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.jobQueue.length === 0) {
      return;
    }

    this.processing = true;
    console.log(`Starting vector worker with ${this.jobQueue.length} jobs`);

    while (this.jobQueue.length > 0) {
      const job = this.jobQueue.shift();
      if (!job) continue;

      try {
        console.log(`Processing vector job for document ${job.documentId}`);
        await vectorStore.addDocument(job.documentId, job.filename, job.chunks, job.title);
        console.log(`Completed vector job for document ${job.documentId}`);
        
        // Add a delay between jobs to prevent system overload
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed vector job for document ${job.documentId}:`, error);
        // Continue with next job even if one fails
      }
    }

    this.processing = false;
    console.log('Vector worker finished processing queue');
  }

  getQueueLength(): number {
    return this.jobQueue.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }
}

export const vectorWorker = new VectorWorker();