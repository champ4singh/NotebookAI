import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";
import Header from "@/components/Header";
import DocumentManager from "@/components/DocumentManager";
import ChatInterface from "@/components/ChatInterface";
import NotesPanel from "@/components/NotesPanel";
import { Brain } from "lucide-react";
import type { Notebook } from "@shared/schema";

export default function Notebook() {
  const { id } = useParams();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: notebook, isLoading: notebookLoading, error } = useQuery<Notebook>({
    queryKey: ["/api/notebooks", id],
    enabled: isAuthenticated && !!id,
  });

  if (isLoading || notebookLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-600">Loading notebook...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to load notebook";

    if (isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return null;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-slate-600">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Notebook Not Found</h1>
          <p className="text-slate-600">The notebook you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header notebook={notebook} />
      <div className="flex-1 flex overflow-hidden">
        <DocumentManager 
          notebookId={id!} 
          selectedDocuments={selectedDocuments}
          onDocumentSelectionChange={setSelectedDocuments}
        />
        <ChatInterface 
          notebookId={id!} 
          selectedDocuments={selectedDocuments}
        />
        <NotesPanel notebookId={id!} />
      </div>
    </div>
  );
}