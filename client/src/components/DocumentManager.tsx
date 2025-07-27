import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileText, Eye, Trash2, CheckSquare, Square } from "lucide-react";
import DocumentPreviewModal from "./DocumentPreviewModal";
import type { Document } from "@shared/schema";

interface DocumentManagerProps {
  notebookId: string;
  selectedDocuments?: string[];
  onDocumentSelectionChange?: (selectedIds: string[]) => void;
}

export default function DocumentManager({ 
  notebookId, 
  selectedDocuments = [], 
  onDocumentSelectionChange 
}: DocumentManagerProps) {
  const { toast } = useToast();
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [localSelectedDocuments, setLocalSelectedDocuments] = useState<string[]>(selectedDocuments);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/notebooks", notebookId, "documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/notebooks/${notebookId}/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks", notebookId, "documents"] });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks", notebookId, "documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt,.md';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadMutation.mutate(file);
      }
    };
    input.click();
  };

  const handleDeleteDocument = (documentId: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      deleteMutation.mutate(documentId);
    }
  };

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getContentPreview = (content: string) => {
    return content.slice(0, 150) + (content.length > 150 ? "..." : "");
  };

  const handleDocumentSelection = (documentId: string, checked: boolean) => {
    const newSelection = checked
      ? [...localSelectedDocuments, documentId]
      : localSelectedDocuments.filter(id => id !== documentId);

    setLocalSelectedDocuments(newSelection);
    onDocumentSelectionChange?.(newSelection);
  };

  const handleSelectAll = () => {
    if (!documents) return;

    const allSelected = documents.length === localSelectedDocuments.length;
    const newSelection = allSelected ? [] : documents.map(doc => doc.id);

    setLocalSelectedDocuments(newSelection);
    onDocumentSelectionChange?.(newSelection);
  };

  const isDocumentSelected = (documentId: string) => {
    return localSelectedDocuments.includes(documentId);
  };

  return (
    <>
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        {/* Document Manager Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Documents</h2>
            <Badge variant="secondary" className="text-xs">
              {documents?.length || 0} files
            </Badge>
          </div>

          {/* Selection Controls */}
          {documents && documents.length > 0 && (
            <div className="flex items-center justify-between mb-3 p-2 bg-slate-50 rounded-md">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={documents.length === localSelectedDocuments.length}
                  onCheckedChange={handleSelectAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm text-slate-700 cursor-pointer">
                  Select All
                </label>
              </div>
              <Badge variant="outline" className="text-xs">
                {localSelectedDocuments.length} selected
              </Badge>
            </div>
          )}

          {/* Upload Button */}
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleFileUpload}
            disabled={uploadMutation.isPending}
          >
            <Plus className="w-4 h-4 mr-2" />
            {uploadMutation.isPending ? "Uploading..." : "Upload Documents"}
          </Button>
        </div>

        {/* Document List */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
          tabIndex={0}
          onKeyDown={(e) => {
            const container = e.currentTarget;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              container.scrollTop += 50;
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              container.scrollTop -= 50;
            }
          }}
        >
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Loading documents...</p>
            </div>
          ) : documents && documents.length > 0 ? (
            documents.map((document: Document) => (
              <div key={document.id} className={`group border rounded-lg p-3 hover:border-blue-600 hover:shadow-sm transition-all ${
                isDocumentSelected(document.id) ? 'border-blue-600 bg-blue-50' : 'border-slate-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <Checkbox
                      checked={isDocumentSelected(document.id)}
                      onCheckedChange={(checked) => handleDocumentSelection(document.id, checked as boolean)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-lg">{getFileIcon(document.fileType)}</span>
                        <h3 className="text-sm font-medium text-slate-900 truncate">
                          {document.filename}
                        </h3>
                      </div>
                      {document.title && (
                        <p className="text-xs text-blue-900 font-bold mb-1 pl-6">
                          {document.title}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 pl-6">
                        Uploaded {new Date(document.createdAt!).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 pl-6">
                        {formatFileSize(document.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto"
                      onClick={() => setSelectedDocument(document)}
                    >
                      <Eye className="w-4 h-4 text-slate-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteDocument(document.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {/* Document Preview Snippet */}
                <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-500 line-clamp-2">
                  {getContentPreview(document.content)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-3">No documents uploaded yet</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleFileUpload}
              >
                Upload Your First Document
              </Button>
            </div>
          )}
        </div>
      </div>

      {selectedDocument && (
        <DocumentPreviewModal
          document={selectedDocument}
          isOpen={!!selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}
    </>
  );
}
