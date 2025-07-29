#!/usr/bin/env python3

"""
NotebookAI Supabase Setup Script (Python)
Run this script from any Windows or Linux system to set up your Supabase database

Usage:
python setup-supabase.py

The script will prompt for your Supabase credentials and set up the complete database schema.
"""

import json
import urllib.request
import urllib.parse
import urllib.error
import re
import sys

def get_user_input(prompt):
    """Get user input with prompt"""
    try:
        return input(prompt).strip()
    except KeyboardInterrupt:
        print("\nSetup cancelled by user")
        sys.exit(0)

def make_request(url, data=None, headers=None):
    """Make HTTP request"""
    if headers is None:
        headers = {}
    
    if data:
        data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    
    req = urllib.request.Request(url, data=data, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            return {
                'status': response.getcode(),
                'data': json.loads(response.read().decode('utf-8'))
            }
    except urllib.error.HTTPError as e:
        return {
            'status': e.code,
            'data': e.read().decode('utf-8')
        }
    except json.JSONDecodeError:
        return {
            'status': response.getcode(),
            'data': response.read().decode('utf-8')
        }

# SQL Schema
SCHEMA_SQL = """
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
"""

def main():
    print("=== NotebookAI Supabase Setup Script ===\n")
    
    try:
        # Get user credentials
        print("Please provide your Supabase credentials:")
        supabase_url = get_user_input("SUPABASE_URL (e.g., https://your-project.supabase.co): ")
        supabase_service_key = get_user_input("SUPABASE_SERVICE_ROLE_KEY: ")
        supabase_anon_key = get_user_input("SUPABASE_ANON_KEY: ")
        database_url = get_user_input("DATABASE_URL (optional, for verification): ")
        
        if not supabase_url or not supabase_service_key:
            print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
            sys.exit(1)
        
        # Extract project reference from URL
        url_match = re.match(r'https://([^.]+)\.supabase\.co', supabase_url)
        if not url_match:
            print("Error: Invalid SUPABASE_URL format")
            sys.exit(1)
        
        project_ref = url_match.group(1)
        print(f"\nConnecting to Supabase project: {project_ref}\n")
        
        # Execute SQL schema
        url = f"https://{project_ref}.supabase.co/rest/v1/rpc/exec_sql"
        headers = {
            'Authorization': f'Bearer {supabase_service_key}',
            'apikey': supabase_service_key
        }
        
        print("Executing database schema...")
        
        response = make_request(url, {'sql': SCHEMA_SQL}, headers)
        
        if response['status'] in [200, 204]:
            print("✅ Database schema created successfully!")
            print("✅ Sample data inserted!")
            print("\n=== Setup Complete ===")
            print("Your NotebookAI database is ready to use.")
            print("\nSample data created:")
            print("- Demo user: demo@notebookai.com")
            print("- Sample notebook: 'Sample Research Notebook'")
            print("- Welcome note with instructions")
        else:
            print(f"Error: HTTP {response['status']}")
            print("Response:", response['data'])
            sys.exit(1)
            
    except Exception as error:
        print(f"Setup failed: {error}")
        sys.exit(1)

if __name__ == "__main__":
    main()