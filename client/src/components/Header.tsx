import { Button } from "@/components/ui/button";
import { Brain, ChevronRight, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import type { Notebook, User } from "@shared/schema";

interface HeaderProps {
  notebook: Notebook;
}

export default function Header({ notebook }: HeaderProps) {
  const { user } = useAuth() as { user: User | undefined };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-4">
        <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Brain className="text-white text-sm" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">NotebookAI</h1>
        </Link>
        
        {/* Breadcrumb */}
        <div className="hidden md:flex items-center space-x-2 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-700">Notebooks</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-900 font-medium">{notebook.title}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Search */}
        <div className="hidden lg:flex items-center space-x-2 bg-slate-100 rounded-lg px-3 py-2">
          <Search className="text-slate-500 w-4 h-4" />
          <Input 
            type="text" 
            placeholder="Search documents..." 
            className="bg-transparent text-sm placeholder-slate-500 border-none outline-none w-64 p-0 h-auto focus-visible:ring-0" 
          />
        </div>
        
        {/* Export Button */}
        <Button variant="outline" size="sm" className="hidden md:flex items-center space-x-2">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </Button>
        
        {/* User Menu */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {getInitials(user?.firstName, user?.lastName)}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : user?.email}
            </p>
            {user?.email && (
              <p className="text-xs text-slate-500">{user.email}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/api/logout'}
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
