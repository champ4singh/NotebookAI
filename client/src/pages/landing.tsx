import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, FileText, MessageSquare, BookOpen } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900">NotebookAI</h1>
          </div>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
            Transform your documents into intelligent conversations. Upload, analyze, and extract insights with AI-powered research assistance.
          </p>
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            onClick={() => window.location.href = '/api/login'}
          >
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          <Card className="text-center">
            <CardContent className="pt-6">
              <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Smart Document Processing</h3>
              <p className="text-slate-600">
                Upload PDFs, Word docs, and text files. Our AI automatically processes and understands your content.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <MessageSquare className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Intelligent Q&A</h3>
              <p className="text-slate-600">
                Ask questions about your documents and get accurate, contextual answers with proper citations.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6">
              <BookOpen className="w-12 h-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Organized Research</h3>
              <p className="text-slate-600">
                Keep your research organized with notebooks, save important insights as notes, and export your findings.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-slate-500 mb-4">Trusted by researchers, students, and professionals</p>
          <div className="flex items-center justify-center space-x-8 opacity-50">
            <span className="text-2xl font-bold">AI</span>
            <span className="text-2xl font-bold">POWERED</span>
            <span className="text-2xl font-bold">RESEARCH</span>
          </div>
        </div>
      </div>
    </div>
  );
}
