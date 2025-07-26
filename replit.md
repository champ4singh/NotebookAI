# NotebookAI

## Overview

NotebookAI is an AI-powered document analysis and chat application built with a modern full-stack architecture. It allows users to upload documents, ask questions about them, and extract insights through interactive conversations with an AI assistant.

## Recent Changes

- **Enhanced Citation System (July 26, 2025)**: Implemented numbered citation references [1], [2] in AI responses with document titles extracted from content. Citations now display as "[1] Document Title - Filename" format.
- **Document Title Extraction**: Added automatic title extraction from document content during upload and display in document sidebar.
- **Improved Document Selection**: Enhanced document filtering to work with extracted titles and maintain consistency across vector search and direct document retrieval.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and production builds
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: Session-based authentication using Replit Auth

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Session Management**: Express sessions with PostgreSQL session store
- **File Upload**: Multer middleware for handling multipart/form-data

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon Database
- **ORM**: Drizzle with schema-first approach
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **File Storage**: Local filesystem for uploaded documents
- **Vector Storage**: In-memory vector store for document embeddings (production would use external vector database)

## Key Components

### Authentication System
- **Provider**: Replit Auth with OpenID Connect
- **Session Management**: Server-side sessions with PostgreSQL storage
- **User Management**: Automatic user creation/update on authentication
- **Authorization**: Middleware-based route protection

### Document Processing Pipeline
- **Supported Formats**: PDF, DOCX, TXT, Markdown files
- **PDF Processing**: pdf-parse for text extraction + Tesseract.js OCR for scanned/image PDFs
- **Text Extraction**: File-type specific processors with OCR fallback
- **Chunking**: Text segmentation for embeddings
- **Embeddings**: Gemini text-embedding-004 model
- **Search**: Cosine similarity-based semantic search

### AI Integration
- **Model**: Google Gemini 2.5 Pro for chat responses
- **Context**: RAG (Retrieval-Augmented Generation) using document chunks
- **Citations**: Automatic source attribution for AI responses
- **Embeddings**: Gemini text-embedding-004 for semantic search

### Database Schema
- **Users**: Profile information and authentication data
- **Notebooks**: Document collections and workspaces
- **Documents**: File metadata and processed content
- **Chat History**: Conversation logs with AI assistant
- **Notes**: User-created and AI-generated notes
- **Sessions**: Authentication session storage

## Data Flow

1. **Authentication**: User logs in via Replit Auth → Session created → User profile stored/updated
2. **Document Upload**: File upload → Text extraction → Chunking → Embedding generation → Vector storage
3. **Chat Query**: User question → Semantic search → Context retrieval → AI response generation → Chat history storage
4. **Note Management**: Manual note creation or saving AI responses → Database storage with optional source linking

## External Dependencies

### Core Dependencies
- **Google Gemini API**: Gemini 2.5 Pro for chat, text-embedding-004 for embeddings
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit Auth**: Authentication provider with OpenID Connect

### Development Tools
- **Vite**: Development server and build tool
- **Drizzle Kit**: Database migrations and schema management
- **TypeScript**: Static type checking
- **ESBuild**: Production bundling for server code

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **TanStack Query**: Data fetching and caching

## Deployment Strategy

### Development Environment
- **Dev Server**: Vite development server with HMR
- **Database**: Neon database with development connection
- **File Uploads**: Local filesystem storage
- **Environment Variables**: Development-specific configuration

### Production Build
- **Frontend**: Vite production build with static file serving
- **Backend**: ESBuild bundling for Node.js deployment
- **Database**: Production Neon database with connection pooling
- **Session Security**: Secure cookies with HTTPS enforcement
- **File Handling**: Production file upload limits and validation

### Configuration
- **Database Migrations**: Drizzle migrations in `/migrations` directory
- **Schema**: Centralized in `/shared/schema.ts` for type safety
- **Environment**: DATABASE_URL, SESSION_SECRET, GEMINI_API_KEY required
- **Build Process**: Dual build (client + server) with shared TypeScript configuration