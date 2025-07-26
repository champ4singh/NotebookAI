import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { X, Bold, Italic, Underline, List, ListOrdered, Link2 } from "lucide-react";
import type { Note } from "@shared/schema";

interface NoteEditorModalProps {
  note: Note | null;
  notebookId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function NoteEditorModal({ note, notebookId, isOpen, onClose }: NoteEditorModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    } else {
      setTitle("");
      setContent("");
    }
  }, [note]);

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
        
        <div className="flex-1 overflow-y-auto space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Note title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold border-none outline-none shadow-none focus-visible:ring-0 px-0"
            />
          </div>
          
          <div className="border border-slate-200 rounded-lg">
            {/* Simple toolbar */}
            <div className="border-b border-slate-200 p-2 flex items-center space-x-2 bg-slate-50 rounded-t-lg">
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
            </div>
            
            <Textarea
              placeholder="Start writing your note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-48 border-none resize-none focus-visible:ring-0 rounded-t-none"
              rows={12}
            />
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
