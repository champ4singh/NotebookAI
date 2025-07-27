import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Underline, List, ListOrdered, Link2, Edit3, Eye, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Note } from "@shared/schema";

interface NoteEditorModalProps {
  note: Note | null;
  notebookId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function NoteEditorModal({
  isOpen,
  onClose,
  note,
  notebookId,
}: NoteEditorModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isViewMode, setIsViewMode] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setIsViewMode(true); // Start in view mode for existing notes
    } else {
      setTitle("");
      setContent("");
      setIsViewMode(false); // Start in edit mode for new notes
    }
  }, [note]);

  const renderMarkdownContent = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines but add spacing
      if (!line.trim()) {
        elements.push(<div key={key++} className="h-3"></div>);
        continue;
      }

      // Handle headers
      if (line.match(/^#{1,6}\s/)) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, '').replace(/---$/, '').trim();

        if (level === 1) {
          elements.push(
            <h1 key={key++} className="text-2xl font-bold text-slate-800 mb-4 pb-3 border-b border-slate-200">
              {text}
            </h1>
          );
        } else if (level === 2) {
          elements.push(
            <h2 key={key++} className="text-xl font-bold text-slate-700 mb-3 mt-6">
              {text}
            </h2>
          );
        } else {
          elements.push(
            <h3 key={key++} className="text-lg font-semibold text-slate-600 mb-3 mt-4">
              {text}
            </h3>
          );
        }
      }
      // Handle bullet points
      else if (line.match(/^\s*[-•*]\s/)) {
        const indent = (line.match(/^\s*/)?.[0].length || 0) / 2;
        const text = line.replace(/^\s*[-•*]\s*/, '');
        const processed = text
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>');

        elements.push(
          <div key={key++} className={`flex items-start mb-2 ${indent > 0 ? `ml-${Math.min(indent * 6, 18)}` : ''}`}>
            <span className="text-blue-600 mr-3 mt-1">•</span>
            <span dangerouslySetInnerHTML={{ __html: processed }} className="leading-relaxed"></span>
          </div>
        );
      }
      // Handle numbered lists
      else if (line.match(/^\s*\d+\.\s/)) {
        const indent = (line.match(/^\s*/)?.[0].length || 0) / 2;
        const match = line.match(/^\s*(\d+)\.\s*(.+)/);
        if (match) {
          const [, number, text] = match;
          const processed = text
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');

          elements.push(
            <div key={key++} className={`flex items-start mb-2 ${indent > 0 ? `ml-${Math.min(indent * 6, 18)}` : ''}`}>
              <span className="text-blue-600 font-semibold mr-3 mt-0.5 min-w-0">{number}.</span>
              <span dangerouslySetInnerHTML={{ __html: processed }} className="leading-relaxed"></span>
            </div>
          );
        }
      }
      // Handle horizontal rules
      else if (line.match(/^---+$/)) {
        elements.push(<hr key={key++} className="my-6 border-slate-200" />);
      }
      // Handle regular paragraphs
      else {
        const processed = line
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-2 py-1 rounded text-sm font-mono">$1</code>');

        elements.push(
          <p key={key++} className="leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: processed }}></p>
        );
      }
    }

    return <div className="space-y-1">{elements}</div>;
  };

  const createMutation = useMutation({
    mutationFn: async (noteData: { title: string; content: string }) => {
      const response = await apiRequest("POST", `/api/notebooks/${notebookId}/notes`, {
        ...noteData,
        sourceType: "manual"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks", notebookId, "notes"] });
      onClose();
      toast({
        title: "Success",
        description: "Note created successfully",
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
        description: "Failed to create note",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (noteData: { title: string; content: string }) => {
      const response = await apiRequest("PUT", `/api/notes/${note!.id}`, noteData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks", notebookId, "notes"] });
      onClose();
      toast({
        title: "Success",
        description: "Note updated successfully",
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
        description: "Failed to update note",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for your note",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please enter some content for your note",
        variant: "destructive",
      });
      return;
    }

    const noteData = { title: title.trim(), content: content.trim() };

    if (note) {
      updateMutation.mutate(noteData);
    } else {
      createMutation.mutate(noteData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] w-full flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>
              {note ? "Edit Note" : "Create New Note"}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {isViewMode ? (
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
            </div>
          ) : (
            <Input
              placeholder="Note title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-4 text-lg font-medium"
            />
          )}

          <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center space-x-1">
                {!isViewMode && (
                  <>
                    <Button variant="ghost" size="sm" className="p-1.5 h-auto">
                      <Bold className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1.5 h-auto">
                      <Italic className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1.5 h-auto">
                      <Underline className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-4 bg-slate-300"></div>
                    <Button variant="ghost" size="sm" className="p-1.5 h-auto">
                      <List className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1.5 h-auto">
                      <ListOrdered className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="p-1.5 h-auto">
                      <Link2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsViewMode(!isViewMode)}
                className="flex items-center space-x-1 text-xs"
              >
                {isViewMode ? (
                  <>
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    <span>View</span>
                  </>
                )}
              </Button>
            </div>

            {isViewMode ? (
              <div className="flex-1 p-4 overflow-y-auto">
                {renderMarkdownContent(content)}
              </div>
            ) : (
              <Textarea
                placeholder="Start writing your note..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-48 border-none resize-none focus-visible:ring-0 rounded-t-none flex-1"
                rows={12}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Saving..." : (note ? "Update Note" : "Save Note")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}