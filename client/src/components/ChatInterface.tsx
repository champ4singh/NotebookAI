import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bot, User, Send, Fan, Copy, Save, Circle } from "lucide-react";
import type { ChatHistory, Document } from "@shared/schema";

interface ChatInterfaceProps {
  notebookId: string;
  selectedDocuments?: string[];
}

// Function to format chat response with better structure
function formatChatResponse(text: string) {
  if (!text) return null;
  
  // Split text into paragraphs and lines
  const lines = text.split('\n');
  const formattedElements: JSX.Element[] = [];
  let key = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines but add spacing
    if (!line) {
      if (formattedElements.length > 0) {
        formattedElements.push(<br key={`br-${key++}`} />);
      }
      continue;
    }
    
    // Handle numbered lists (1. 2. 3. etc.)
    if (/^\d+\.\s/.test(line)) {
      formattedElements.push(
        <div key={key++} className="ml-4 mb-2">
          <span className="font-medium text-blue-700">{line.match(/^\d+\./)?.[0]}</span>
          <span className="ml-2">{line.replace(/^\d+\.\s*/, '')}</span>
        </div>
      );
    }
    // Handle bullet points (- or • or *)
    else if (/^[-•*]\s/.test(line)) {
      formattedElements.push(
        <div key={key++} className="ml-4 mb-1 flex items-start">
          <span className="text-blue-600 mr-2 mt-1">•</span>
          <span>{line.replace(/^[-•*]\s*/, '')}</span>
        </div>
      );
    }
    // Handle sub-bullet points (indented)
    else if (/^\s+[-•*]\s/.test(line)) {
      formattedElements.push(
        <div key={key++} className="ml-8 mb-1 flex items-start">
          <span className="text-slate-400 mr-2 mt-1">◦</span>
          <span>{line.replace(/^\s*[-•*]\s*/, '')}</span>
        </div>
      );
    }
    // Handle headings (lines that end with :)
    else if (line.endsWith(':') && line.length < 80) {
      formattedElements.push(
        <div key={key++} className="font-semibold text-slate-800 mt-3 mb-2">
          {line}
        </div>
      );
    }
    // Handle citation references [1], [2], etc.
    else if (/\[\d+\]/.test(line)) {
      const parts = line.split(/(\[\d+\])/);
      formattedElements.push(
        <div key={key++} className="mb-2">
          {parts.map((part, index) => 
            /\[\d+\]/.test(part) ? (
              <span key={index} className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs font-medium mr-1">
                {part}
              </span>
            ) : (
              <span key={index}>{part}</span>
            )
          )}
        </div>
      );
    }
    // Regular paragraphs
    else {
      // Check if this line contains citation references and format them
      if (/\[\d+\]/.test(line)) {
        const parts = line.split(/(\[\d+\])/);
        formattedElements.push(
          <p key={key++} className="mb-2 leading-relaxed">
            {parts.map((part, index) => 
              /\[\d+\]/.test(part) ? (
                <span key={index} className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs font-medium mx-0.5">
                  {part}
                </span>
              ) : (
                <span key={index}>{part}</span>
              )
            )}
          </p>
        );
      } else {
        formattedElements.push(
          <p key={key++} className="mb-2 leading-relaxed">
            {line}
          </p>
        );
      }
    }
  }
  
  return <div className="space-y-1">{formattedElements}</div>;
}

export default function ChatInterface({ notebookId, selectedDocuments = [] }: ChatInterfaceProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chatHistory = [], isLoading } = useQuery<ChatHistory[]>({
    queryKey: ["/api/notebooks", notebookId, "chat"],
  });

  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/notebooks", notebookId, "documents"],
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      console.log(`Sending chat with selectedDocuments:`, selectedDocuments);
      const response = await apiRequest("POST", `/api/notebooks/${notebookId}/chat`, {
        message: message,
        selectedDocuments: selectedDocuments.length > 0 ? selectedDocuments : undefined
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks", notebookId, "chat"] });
      setMessage("");
      setIsTyping(false);
    },
    onError: (error) => {
      setIsTyping(false);
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
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const saveAsNoteMutation = useMutation({
    mutationFn: async ({ title, content, chatId }: { title: string; content: string; chatId: string }) => {
      const response = await apiRequest("POST", `/api/notebooks/${notebookId}/notes`, {
        title,
        content,
        sourceType: "ai_generated",
        linkedChatId: chatId
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks", notebookId, "notes"] });
      toast({
        title: "Success",
        description: "Response saved as note",
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
        description: "Failed to save note",
        variant: "destructive",
      });
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/notebooks/${notebookId}/chat`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks", notebookId, "chat"] });
      toast({
        title: "Success",
        description: "Chat history cleared",
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
        description: "Failed to clear chat",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim()) return;
    chatMutation.mutate(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveAsNote = (chat: ChatHistory) => {
    const title = `AI Response - ${new Date(chat.createdAt!).toLocaleDateString()}`;
    saveAsNoteMutation.mutate({
      title,
      content: chat.aiResponse,
      chatId: chat.id
    });
  };

  const handleCopyResponse = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied",
      description: "Response copied to clipboard",
    });
  };

  const handleClearChat = () => {
    clearChatMutation.mutate();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isTyping]);

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">AI Assistant</h2>
              <p className="text-sm text-slate-500">Ask questions about your documents</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearChat}
              disabled={clearChatMutation.isPending}
            >
              <Fan className="w-4 h-4 mr-1" />
              Clear Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome Message */}
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                Hello! I'm your AI research assistant. I can help you analyze and extract insights from your uploaded documents. 
                Feel free to ask me questions about their content, request summaries, or explore specific topics.
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-2">Just now</p>
          </div>
        </div>

        {/* Chat History */}
        {isLoading ? (
          <div className="text-center py-4">
            <p className="text-slate-500">Loading chat history...</p>
          </div>
        ) : chatHistory && chatHistory.length > 0 ? (
          chatHistory.map((chat: ChatHistory) => (
            <div key={chat.id} className="space-y-4">
              {/* User Message */}
              <div className="flex items-start space-x-3 justify-end">
                <div className="flex-1 max-w-2xl">
                  <div className="bg-blue-600 text-white rounded-lg p-4 ml-auto max-w-fit">
                    <p className="text-sm">{chat.userPrompt}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-right">
                    {new Date(chat.createdAt!).toLocaleTimeString()}
                  </p>
                </div>
                <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              </div>

              {/* AI Response */}
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="text-sm text-slate-700 prose prose-sm max-w-none">
                      {formatChatResponse(chat.aiResponse as string)}
                    </div>

                    {/* Citations */}
                    {chat.metadata && typeof chat.metadata === 'object' && 'citations' in chat.metadata && Array.isArray((chat.metadata as any).citations) && (chat.metadata as any).citations.length > 0 && (
                      <div className="mt-3 p-2 bg-white rounded border-l-4 border-blue-600">
                        <p className="text-xs text-slate-500 mb-2">Sources:</p>
                        <div className="space-y-1">
                          {((chat.metadata as any).citations as any[]).map((citation: any, index: number) => {
                            // Use stored title or create one from filename
                            const title = citation.title || citation.filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
                            return (
                              <div key={index} className="text-xs text-slate-600">
                                <span className="font-medium">[{index + 1}]</span> {title} - {citation.filename}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 mt-2">
                    <p className="text-xs text-slate-500">
                      {new Date(chat.createdAt!).toLocaleTimeString()}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-auto p-1"
                      onClick={() => handleSaveAsNote(chat)}
                    >
                      <Save className="w-3 h-3 mr-1" />
                      Save as Note
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-auto p-1"
                      onClick={() => handleCopyResponse(chat.aiResponse as string)}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : null}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <Circle className="w-2 h-2 text-slate-400 animate-bounce" />
                    <Circle className="w-2 h-2 text-slate-400 animate-bounce [animation-delay:0.1s]" />
                    <Circle className="w-2 h-2 text-slate-400 animate-bounce [animation-delay:0.2s]" />
                  </div>
                  <span className="text-sm text-slate-500">AI is analyzing your documents...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <div className="relative">
              <Textarea
                placeholder="Ask a question about your documents..."
                className="resize-none pr-12 min-h-[44px]"
                rows={1}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatMutation.isPending}
              />
              <Button
                size="sm"
                className="absolute right-2 bottom-2 bg-blue-600 hover:bg-blue-700"
                onClick={handleSendMessage}
                disabled={!message.trim() || chatMutation.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-3 text-xs text-slate-500">
                <span>Press Enter to send, Shift+Enter for new line</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span>{documents?.length || 0} documents</span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>AI Ready</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}