-- NotebookAI Database Schema for Supabase
-- Run this script directly in your Supabase SQL Editor

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notebooks table
CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_vectors table for vector embeddings
CREATE TABLE IF NOT EXISTS document_vectors (
    id SERIAL PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_history table
CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    source_type TEXT,
    source_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table for authentication
CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_notebook_id ON documents(notebook_id);
CREATE INDEX IF NOT EXISTS idx_document_vectors_document_id ON document_vectors(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_notebook_id ON chat_history(notebook_id);
CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON notes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS idx_document_vectors_embedding 
ON document_vectors USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Insert dummy user data
INSERT INTO users (id, email, name) VALUES 
('default-user', 'demo@notebookai.com', 'Demo User')
ON CONFLICT (id) DO NOTHING;

-- Insert sample notebook
INSERT INTO notebooks (id, title, description, user_id) VALUES 
('sample-notebook-1', 'Sample Research Notebook', 'A demo notebook for testing NotebookAI functionality', 'default-user')
ON CONFLICT (id) DO NOTHING;

-- Insert sample note
INSERT INTO notes (id, title, content, notebook_id, source_type) VALUES 
('sample-note-1', 'Welcome to NotebookAI', 'This is a sample note to get you started. Upload documents and start asking questions!', 'sample-notebook-1', 'manual')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE users IS 'User profiles and authentication data';
COMMENT ON TABLE notebooks IS 'Document collections and workspaces';
COMMENT ON TABLE documents IS 'Uploaded document metadata and content';
COMMENT ON TABLE document_vectors IS 'Vector embeddings for semantic search';
COMMENT ON TABLE chat_history IS 'AI chat conversation logs';
COMMENT ON TABLE notes IS 'User-created and AI-generated notes';
COMMENT ON TABLE sessions IS 'Authentication session storage';