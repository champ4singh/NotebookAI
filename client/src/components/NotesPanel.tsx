import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Bot, User, Edit, Trash2, Download, Link, GraduationCap, FileText, HelpCircle, Clock, MoreVertical, Type, Minus, Plus as PlusIcon } from "lucide-react";
import NoteEditorModal from "./NoteEditorModal";
import type { Note } from "@shared/schema";

interface NotesPanelProps {
  notebookId: string;
}

export default function NotesPanel({ notebookId }: NotesPanelProps) {
  const { toast } = useToast();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [generatingContent, setGeneratingContent] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(12); // Default reduced by 2 points

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

  const generateAIContentMutation = useMutation({
    mutationFn: async ({ type, notebookId }: { type: string; notebookId: string }) => {
      const response = await apiRequest("POST", `/api/notebooks/${notebookId}/generate-ai-content`, {
        contentType: type,
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks", notebookId, "notes"] });
      setGeneratingContent(null);
      const contentTypeName = data.contentType ? 
        data.contentType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 
        'AI content';
      toast({
        title: "Success",
        description: `${contentTypeName} generated successfully`,
      });
    },
    onError: (error: any) => {
      setGeneratingContent(null);
      console.error("AI content generation error:", error);
      
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
      
      const errorMessage = error?.message || error?.response?.data?.message || "Failed to generate AI content";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleCreateNote = () => {
    setSelectedNote(null);
    setIsEditorOpen(true);
  };

  const handleGenerateAIContent = (type: string) => {
    setGeneratingContent(type);
    generateAIContentMutation.mutate({ type, notebookId });
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
    // Strip markdown formatting and get plain text preview
    const plainText = content
      .replace(/^#{1,6}\s+/gm, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/^[-*+]\s+/gm, '') // Remove bullet points
      .replace(/^\d+\.\s+/gm, '') // Remove numbered lists
      .replace(/^>\s+/gm, '') // Remove blockquotes
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\n+/g, ' ') // Replace line breaks with spaces
      .trim();
    return plainText.slice(0, 150) + (plainText.length > 150 ? "..." : "");
  };

  const renderMarkdownContent = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines but add spacing
      if (!line.trim()) {
        elements.push(<div key={key++} className="h-2"></div>);
        continue;
      }

      // Handle headers
      if (line.match(/^#{1,6}\s/)) {
        const level = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, '').replace(/---$/, '').trim();
        
        if (level === 1) {
          elements.push(
            <h1 key={key++} className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200" style={{ fontSize: `${fontSize + 6}px` }}>
              {text}
            </h1>
          );
        } else if (level === 2) {
          elements.push(
            <h2 key={key++} className="font-bold text-slate-700 mb-2 mt-4" style={{ fontSize: `${fontSize + 4}px` }}>
              {text}
            </h2>
          );
        } else {
          elements.push(
            <h3 key={key++} className="font-semibold text-slate-600 mb-2 mt-3" style={{ fontSize: `${fontSize + 2}px` }}>
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
          <div key={key++} className={`flex items-start mb-1 ${indent > 0 ? `ml-${Math.min(indent * 4, 12)}` : ''}`}>
            <span className="text-blue-600 mr-2 mt-1" style={{ fontSize: `${fontSize}px` }}>•</span>
            <span dangerouslySetInnerHTML={{ __html: processed }} className="leading-relaxed" style={{ fontSize: `${fontSize}px` }}></span>
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
            <div key={key++} className={`flex items-start mb-1 ${indent > 0 ? `ml-${Math.min(indent * 4, 12)}` : ''}`}>
              <span className="text-blue-600 font-semibold mr-2 mt-0.5 min-w-0" style={{ fontSize: `${fontSize}px` }}>{number}.</span>
              <span dangerouslySetInnerHTML={{ __html: processed }} className="leading-relaxed" style={{ fontSize: `${fontSize}px` }}></span>
            </div>
          );
        }
      }
      // Handle horizontal rules
      else if (line.match(/^---+$/)) {
        elements.push(<hr key={key++} className="my-4 border-slate-200" />);
      }
      // Handle regular paragraphs
      else {
        const processed = line
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, `<code class="bg-slate-100 px-1 py-0.5 rounded" style="font-size: ${fontSize}px">$1</code>`);
        
        elements.push(
          <p key={key++} className="leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: processed }} style={{ fontSize: `${fontSize}px` }}></p>
        );
      }
    }

    return <div className="space-y-1">{elements}</div>;
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
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-auto"
                onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                disabled={fontSize <= 10}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-xs text-slate-500 px-1">{fontSize}px</span>
              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-auto"
                onClick={() => setFontSize(Math.min(20, fontSize + 1))}
                disabled={fontSize >= 20}
              >
                <PlusIcon className="w-3 h-3" />
              </Button>
              <MoreVertical className="w-4 h-4 text-slate-500 ml-2" />
            </div>
          </div>
          
          {/* Add Note Button */}
          <Button 
            variant="outline"
            className="w-full mb-3"
            onClick={handleCreateNote}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add note
          </Button>

          {/* AI Content Generation Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center justify-start p-2 h-auto"
              onClick={() => handleGenerateAIContent('study_guide')}
              disabled={generatingContent === 'study_guide'}
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              <span className="text-xs">Study guide</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="flex items-center justify-start p-2 h-auto"
              onClick={() => handleGenerateAIContent('briefing_doc')}
              disabled={generatingContent === 'briefing_doc'}
            >
              <FileText className="w-4 h-4 mr-2" />
              <span className="text-xs">Briefing doc</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="flex items-center justify-start p-2 h-auto"
              onClick={() => handleGenerateAIContent('faq')}
              disabled={generatingContent === 'faq'}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              <span className="text-xs">FAQ</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="flex items-center justify-start p-2 h-auto"
              onClick={() => handleGenerateAIContent('timeline')}
              disabled={generatingContent === 'timeline'}
            >
              <Clock className="w-4 h-4 mr-2" />
              <span className="text-xs">Timeline</span>
            </Button>
          </div>

          {generatingContent && (
            <div className="mt-3 text-center">
              <p className="text-xs text-slate-500">
                Generating {generatingContent.replace('_', ' ')}...
              </p>
            </div>
          )}
        </div>

        {/* Notes List */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset custom-scrollbar"
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
                        note.aiContentType === 'study_guide' ? <GraduationCap className="w-3 h-3 text-white" /> :
                        note.aiContentType === 'briefing_doc' ? <FileText className="w-3 h-3 text-white" /> :
                        note.aiContentType === 'faq' ? <HelpCircle className="w-3 h-3 text-white" /> :
                        note.aiContentType === 'timeline' ? <Clock className="w-3 h-3 text-white" /> :
                        <Bot className="w-3 h-3 text-white" />
                      ) : (
                        <User className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {note.sourceType === 'ai_generated' ? 
                        note.aiContentType === 'study_guide' ? 'Study Guide' :
                        note.aiContentType === 'briefing_doc' ? 'Briefing Doc' :
                        note.aiContentType === 'faq' ? 'FAQ' :
                        note.aiContentType === 'timeline' ? 'Timeline' :
                        'AI Generated'
                        : 'Manual Note'
                      }
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
