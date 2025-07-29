# NotebookAI

An AI-powered document analysis and chat application built with React, Express, and Supabase.

## Features

- Upload and process PDF, DOCX, TXT, and Markdown documents
- AI-powered chat interface for document Q&A
- Generate study guides, briefing documents, FAQs, and timelines
- Vector search using Supabase pgvector extension
- Organized notebooks for research management

## Environment Setup

### For Local Development

1. Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL=your_supabase_database_url_here

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# API Keys
GEMINI_API_KEY=your_gemini_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-here-make-it-very-long-and-random
```

2. Copy the values from your Supabase project dashboard and Google AI Studio.

### For Replit Deployment

The application is configured to read from both `.env` files and Replit Secrets. In Replit, add the following secrets:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `PINECONE_API_KEY` (legacy, not used with Supabase)
- `SESSION_SECRET`

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your Supabase database:
```bash
npm run db:push
```

3. Start the development server:
```bash
npm run dev
```

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL with pgvector)
- **AI**: Google Gemini Pro for chat, Gemini text-embedding-004 for embeddings
- **Build**: Vite for frontend, ESBuild for backend

## Architecture

The application uses a modern full-stack architecture:

- **Client**: React frontend with TypeScript and Tailwind CSS
- **Server**: Express.js backend with TypeScript
- **Database**: Supabase PostgreSQL with pgvector extension for vector storage
- **AI Integration**: Google Gemini for text generation and embeddings
- **Authentication**: Simplified demo user system

## Database Schema

- `users` - User profiles and authentication
- `notebooks` - Document collections and workspaces
- `documents` - File metadata and processed content
- `document_vectors` - Vector embeddings for semantic search
- `chat_history` - Conversation logs with AI assistant
- `notes` - User-created and AI-generated notes
- `sessions` - Authentication session storage

## Development

The application uses a dual-build system:
- Frontend builds with Vite
- Backend compiles with TypeScript
- Shared schema types between client and server
- Hot module replacement in development

## Deployment

The application is designed to run on Replit with automatic deployments. It can also be deployed to any Node.js hosting platform with PostgreSQL support.