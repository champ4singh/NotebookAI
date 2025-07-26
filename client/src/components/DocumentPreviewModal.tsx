import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Document } from "@shared/schema";

interface DocumentPreviewModalProps {
  document: Document;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentPreviewModal({ document, isOpen, onClose }: DocumentPreviewModalProps) {
  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case '.pdf':
        return '📄';
      case '.docx':
        return '📝';
      case '.txt':
        return '📃';
      case '.md':
        return '📋';
      default:
        return '📄';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-full flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-xl">{getFileIcon(document.fileType)}</span>
              <DialogTitle>{document.filename}</DialogTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          <div className="prose prose-sm max-w-none p-4">
            {document.fileType === '.md' ? (
              <div 
                className="whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: document.content.replace(/\n/g, '<br>') }}
              />
            ) : (
              <div className="whitespace-pre-wrap font-mono text-sm">
                {document.content}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
