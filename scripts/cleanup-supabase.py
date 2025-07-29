#!/usr/bin/env python3

"""
NotebookAI Supabase Cleanup Script
This script connects directly to PostgreSQL to clean up all data except users table

Usage:
pip install psycopg2-binary
python cleanup-supabase.py

The script will prompt for your database credentials and clean up all tables except users.
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
        print("\nCleanup cancelled by user")
        sys.exit(0)

def get_confirmation(prompt):
    """Get yes/no confirmation from user"""
    while True:
        response = get_user_input(f"{prompt} (yes/no): ").lower()
        if response in ['yes', 'y']:
            return True
        elif response in ['no', 'n']:
            return False
        else:
            print("Please enter 'yes' or 'no'")

# SQL Cleanup queries - ordered to respect foreign key constraints
CLEANUP_QUERIES = [
    "DELETE FROM chat_history;",
    "DELETE FROM notes;", 
    "DELETE FROM document_vectors;",
    "DELETE FROM documents;",
    "DELETE FROM notebooks;",
    "DELETE FROM sessions;",
    # Users table is preserved
]

def main():
    print("=== NotebookAI Supabase Cleanup Script ===\n")
    print("⚠️  WARNING: This will delete ALL data except users!")
    print("The following tables will be cleared:")
    print("- chat_history")
    print("- notes")
    print("- document_vectors")
    print("- documents")
    print("- notebooks")
    print("- sessions")
    print("\nThe 'users' table will be preserved.\n")
    
    if not get_confirmation("Are you sure you want to proceed?"):
        print("Cleanup cancelled.")
        sys.exit(0)
    
    try:
        # Get database connection details
        print("\nPlease provide your database connection details:")
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
        
        # Check which tables exist before cleanup
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('chat_history', 'notes', 'document_vectors', 'documents', 'notebooks', 'sessions')
            ORDER BY table_name;
        """)
        
        existing_tables = [row[0] for row in cursor.fetchall()]
        print(f"Found tables to clean: {', '.join(existing_tables)}")
        
        if not existing_tables:
            print("No tables found to clean up.")
            cursor.close()
            conn.close()
            return
        
        # Get row counts before cleanup
        print("\nCurrent row counts:")
        table_counts = {}
        for table in existing_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            count = cursor.fetchone()[0]
            table_counts[table] = count
            print(f"- {table}: {count} rows")
        
        # Check users table
        cursor.execute("SELECT COUNT(*) FROM users;")
        user_count = cursor.fetchone()[0]
        print(f"- users: {user_count} rows (will be preserved)")
        
        print(f"\nExecuting cleanup queries...")
        
        total_deleted = 0
        
        # Execute cleanup queries
        for query in CLEANUP_QUERIES:
            table_name = query.split()[2].rstrip(';')
            if table_name in existing_tables:
                print(f"Cleaning {table_name}...")
                cursor.execute(query)
                deleted_count = table_counts.get(table_name, 0)
                total_deleted += deleted_count
                print(f"✅ Deleted {deleted_count} rows from {table_name}")
        
        print(f"\n✅ Cleanup completed successfully!")
        print(f"✅ Total rows deleted: {total_deleted}")
        print(f"✅ Users preserved: {user_count} rows")
        
        # Verify cleanup
        print(f"\nVerifying cleanup...")
        for table in existing_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table};")
            count = cursor.fetchone()[0]
            print(f"- {table}: {count} rows remaining")
        
        cursor.close()
        conn.close()
        
        print(f"\n=== Cleanup Complete ===")
        print("Your NotebookAI database has been cleaned up.")
        print("All user data has been preserved.")
        
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        sys.exit(1)
    except Exception as error:
        print(f"Cleanup failed: {error}")
        sys.exit(1)

if __name__ == "__main__":
    main()