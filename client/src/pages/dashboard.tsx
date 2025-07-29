import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, Plus, FileText, MessageSquare, BookOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Notebook } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState("");

  const { data: notebooks, isLoading: notebooksLoading } = useQuery<Notebook[]>({
    queryKey: ["/api/notebooks"],
  });

  const createNotebookMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("POST", "/api/notebooks", { title });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks"] });
      setIsCreateDialogOpen(false);
      setNewNotebookTitle("");
      toast({
        title: "Success",
        description: "Notebook created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create notebook",
        variant: "destructive",
      });
    },
  });

  const deleteNotebookMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notebooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notebooks"] });
      toast({
        title: "Success",
        description: "Notebook deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete notebook",
        variant: "destructive",
      });
    },
  });

  const handleCreateNotebook = () => {
    if (!newNotebookTitle.trim()) return;
    createNotebookMutation.mutate(newNotebookTitle);
  };

  const handleDeleteNotebook = (id: string) => {
    if (confirm("Are you sure you want to delete this notebook? This action cannot be undone.")) {
      deleteNotebookMutation.mutate(id);
    }
  };

  if (notebooksLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-600">Loading your notebooks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">NotebookAI</h1>
          </div>
          <Button
            variant="outline"
            onClick={() => setLocation('/')}
          >
            Home
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Your Notebooks</h2>
          <p className="text-slate-600">Organize your research with AI-powered document analysis</p>
        </div>

        {/* Create Notebook Button */}
        <div className="mb-8">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create New Notebook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Notebook</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Notebook Title</Label>
                  <Input
                    id="title"
                    value={newNotebookTitle}
                    onChange={(e) => setNewNotebookTitle(e.target.value)}
                    placeholder="Enter notebook title..."
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateNotebook}
                    disabled={!newNotebookTitle.trim() || createNotebookMutation.isPending}
                  >
                    {createNotebookMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Notebooks Grid */}
        {notebooks && notebooks.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notebooks.map((notebook: Notebook) => (
              <Card 
                key={notebook.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => setLocation(`/notebook/${notebook.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{notebook.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNotebook(notebook.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                    <span>Created {new Date(notebook.createdAt!).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-slate-600">
                    <div className="flex items-center space-x-1">
                      <FileText className="w-4 h-4" />
                      <span>0 docs</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>0 chats</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <BookOpen className="w-4 h-4" />
                      <span>0 notes</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Brain className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-600 mb-2">No notebooks yet</h3>
            <p className="text-slate-500 mb-6">Create your first notebook to start analyzing documents with AI</p>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Notebook
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Notebook</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Notebook Title</Label>
                    <Input
                      id="title"
                      value={newNotebookTitle}
                      onChange={(e) => setNewNotebookTitle(e.target.value)}
                      placeholder="Enter notebook title..."
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateNotebook}
                      disabled={!newNotebookTitle.trim() || createNotebookMutation.isPending}
                    >
                      {createNotebookMutation.isPending ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </main>
    </div>
  );
}
