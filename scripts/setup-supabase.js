#!/usr/bin/env node

/**
 * NotebookAI Supabase Setup Script
 * Run this script from any Windows or Linux system to set up your Supabase database
 * 
 * Usage:
 * node setup-supabase.js
 * 
 * The script will prompt for your Supabase credentials and set up the complete database schema.
 */

const https = require('https');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Function to make HTTP requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// SQL Schema
const SCHEMA_SQL = `
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
`;

async function main() {
  console.log('=== NotebookAI Supabase Setup Script ===\\n');
  
  try {
    // Get user credentials
    console.log('Please provide your Supabase credentials:');
    const supabaseUrl = await prompt('SUPABASE_URL (e.g., https://your-project.supabase.co): ');
    const supabaseServiceKey = await prompt('SUPABASE_SERVICE_ROLE_KEY: ');
    const supabaseAnonKey = await prompt('SUPABASE_ANON_KEY: ');
    const databaseUrl = await prompt('DATABASE_URL (optional, for verification): ');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
      process.exit(1);
    }
    
    // Extract project reference from URL
    const urlMatch = supabaseUrl.match(/https:\\/\\/([^.]+)\\.supabase\\.co/);
    if (!urlMatch) {
      console.error('Error: Invalid SUPABASE_URL format');
      process.exit(1);
    }
    
    const projectRef = urlMatch[1];
    console.log(`\nConnecting to Supabase project: ${projectRef}\n`);
    
    // Execute SQL schema
    const options = {
      hostname: `${projectRef}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      }
    };
    
    console.log('ERROR: The REST API approach doesn\\'t support DDL operations.');
    console.log('Please use one of these alternatives:');
    console.log('');
    console.log('OPTION 1 (RECOMMENDED): Use the SQL script directly');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of \\'supabase-schema.sql\\'');
    console.log('4. Click \\'Run\\' to execute');
    console.log('');
    console.log('OPTION 2: Use the direct SQL Python script');
    console.log('1. Install psycopg2: pip install psycopg2-binary');
    console.log('2. Run: python setup-supabase-sql.py');
    console.log('3. Enter your database connection details');
    console.log('');
    
    const response = { status: 400, data: 'REST API method not supported for DDL' };
    
    if (response.status === 200 || response.status === 204) {
      console.log('✅ Database schema created successfully!');
      console.log('✅ Sample data inserted!');
      console.log('\\n=== Setup Complete ===');
      console.log('Your NotebookAI database is ready to use.');
      console.log('\\nSample data created:');
      console.log('- Demo user: demo@notebookai.com');
      console.log('- Sample notebook: "Sample Research Notebook"');
      console.log('- Welcome note with instructions');
    } else {
      console.error(`Error: HTTP ${response.status}`);
      console.error('Response:', response.data);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nSetup cancelled by user');
  rl.close();
  process.exit(0);
});

main();