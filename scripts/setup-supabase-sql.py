#!/usr/bin/env python3

"""
NotebookAI Supabase Setup Script (Direct SQL)
This script connects directly to PostgreSQL using psycopg2 to execute the schema

Usage:
pip install psycopg2-binary
python setup-supabase-sql.py

The script will prompt for your database credentials and set up the complete database schema.
"""

import sys

try:
    import psycopg2
except ImportError:
    print("Error: psycopg2 is required. Install it with:")
    print("pip install psycopg2-binary")
    sys.exit(1)

def get_user_input(prompt):
    """Get user input with prompt"""
    try:
        return input(prompt).strip()
    except KeyboardInterrupt:
        print("\nSetup cancelled by user")
        sys.exit(0)

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
    print("=== NotebookAI Supabase Setup Script (Direct SQL) ===\n")
    
    try:
        # Get database connection details
        print("Please provide your database connection details:")
        print("You can use either format:")
        print("1. Full DATABASE_URL: postgresql://user:pass@host:port/dbname")
        print("2. Individual components\n")
        
        database_url = get_user_input("DATABASE_URL (or press Enter to use components): ")
        
        if database_url:
            # Use full database URL
            conn_params = database_url
        else:
            # Get individual components
            host = get_user_input("Host (e.g., db.your-project.supabase.co): ")
            port = get_user_input("Port (default 5432): ") or "5432"
            database = get_user_input("Database name (default postgres): ") or "postgres"
            user = get_user_input("Username (default postgres): ") or "postgres"
            password = get_user_input("Password: ")
            
            if not password:
                print("Error: Password is required")
                sys.exit(1)
            
            conn_params = {
                'host': host,
                'port': port,
                'database': database,
                'user': user,
                'password': password
            }
        
        print(f"\nConnecting to database...")
        
        # Connect to database
        conn = psycopg2.connect(conn_params)
        conn.autocommit = True
        
        cursor = conn.cursor()
        
        print("Executing database schema...")
        
        # Execute the schema
        cursor.execute(SCHEMA_SQL)
        
        print("✅ Database schema created successfully!")
        print("✅ Sample data inserted!")
        print("\n=== Setup Complete ===")
        print("Your NotebookAI database is ready to use.")
        print("\nSample data created:")
        print("- Demo user: demo@notebookai.com")
        print("- Sample notebook: 'Sample Research Notebook'")
        print("- Welcome note with instructions")
        
        # Verify tables exist
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        tables = [row[0] for row in cursor.fetchall()]
        expected_tables = ['users', 'notebooks', 'documents', 'document_vectors', 'chat_history', 'notes', 'sessions']
        
        print(f"\n✅ Created tables: {', '.join(tables)}")
        missing_tables = [t for t in expected_tables if t not in tables]
        if missing_tables:
            print(f"⚠️  Missing tables: {', '.join(missing_tables)}")
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        sys.exit(1)
    except Exception as error:
        print(f"Setup failed: {error}")
        sys.exit(1)

if __name__ == "__main__":
    main()