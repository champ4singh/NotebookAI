import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Bot, User, Edit, Trash2, Download, Link } from "lucide-react";
import NoteEditorModal from "./NoteEditorModal";
import type { Note } from "@shared/schema";

interface NotesPanelProps {
  notebookId: string;
}

export default function NotesPanel({ notebookId }: NotesPanelProps) {
  const { toast } = useToast();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["/api/notebooks", notebookId, "notes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks", notebookId, "notes"] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
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
        description: "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  const handleCreateNote = () => {
    setSelectedNote(null);
    setIsEditorOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setSelectedNote(note);
    setIsEditorOpen(true);
  };

  const handleDeleteNote = (noteId: string) => {
    if (confirm("Are you sure you want to delete this note?")) {
      deleteMutation.mutate(noteId);
    }
  };

  const getContentPreview = (content: string) => {
    // Strip HTML tags and get plain text preview
    const plainText = content.replace(/<[^>]*>/g, '');
    return plainText.slice(0, 150) + (plainText.length > 150 ? "..." : "");
  };

  const formatRelativeTime = (date: string) => {
    const now = new Date();
    const noteDate = new Date(date);
    const diffMs = now.getTime() - noteDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return noteDate.toLocaleDateString();
  };

  return (
    <>
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
        {/* Notes Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Notes</h2>
            <Badge variant="secondary" className="text-xs">
              {notes?.length || 0} notes
            </Badge>
          </div>
          
          {/* Create Note Button */}
          <Button 
            variant="outline"
            className="w-full"
            onClick={handleCreateNote}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Note
          </Button>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-slate-500">Loading notes...</p>
            </div>
          ) : notes && notes.length > 0 ? (
            notes.map((note: Note) => (
              <div 
                key={note.id} 
                className="border border-slate-200 rounded-lg p-3 hover:border-blue-600 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => handleEditNote(note)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-6 h-6 rounded flex items-center justify-center ${
                      note.sourceType === 'ai_generated' 
                        ? 'bg-gradient-to-br from-blue-600 to-blue-700' 
                        : 'bg-slate-400'
                    }`}>
                      {note.sourceType === 'ai_generated' ? (
                        <Bot className="w-3 h-3 text-white" />
                      ) : (
                        <User className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {note.sourceType === 'ai_generated' ? 'AI Generated' : 'Manual Note'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditNote(note);
                      }}
                    >
                      <Edit className="w-3 h-3 text-slate-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-auto text-red-500 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                <h3 className="text-sm font-medium text-slate-900 mb-2 line-clamp-1">
                  {note.title}
                </h3>
                
                <p className="text-xs text-slate-500 line-clamp-3 mb-2">
                  {getContentPreview(note.content)}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {formatRelativeTime(note.createdAt!.toString())}
                  </span>
                  <div className="flex items-center space-x-1">
                    {note.linkedChatId ? (
                      <>
                        <Link className="w-3 h-3 text-blue-600" />
                        <span className="text-xs text-blue-600">Linked to chat</span>
                      </>
                    ) : note.sourceType === 'manual' ? (
                      <>
                        <Edit className="w-3 h-3 text-slate-500" />
                        <span className="text-xs text-slate-500">Manual</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-3">No notes yet</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCreateNote}
              >
                Create Your First Note
              </Button>
            </div>
          )}
        </div>

        {/* Notes Footer */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{notes?.length || 0} notes total</span>
            <Button variant="ghost" size="sm" className="h-auto p-1">
              <Download className="w-3 h-3 mr-1" />
              Export All
            </Button>
          </div>
        </div>
      </div>

      {isEditorOpen && (
        <NoteEditorModal
          note={selectedNote}
          notebookId={notebookId}
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setSelectedNote(null);
          }}
        />
      )}
    </>
  );
}
