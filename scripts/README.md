# NotebookAI Database Setup Scripts

This folder contains scripts to set up your Supabase database for NotebookAI.

## Option 1: Direct Supabase Setup (Recommended)

Use the SQL file directly in your Supabase dashboard:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** in the sidebar
4. Create a new query and paste the contents of `supabase-schema.sql`
5. Click **Run** to execute the schema

## Option 2: Remote Setup Scripts

Run these scripts from any Windows or Linux system to automatically set up your database.

### Prerequisites

You'll need one of the following:
- **Node.js** (for the JavaScript version)
- **Python 3** (for the Python version)

### JavaScript Version

```bash
# Make sure you have Node.js installed
node setup-supabase.js
```

### Python Version (REST API - Limited)

```bash
# Make sure you have Python 3 installed
python setup-supabase.py
# or
python3 setup-supabase.py
```

### Python Version (Direct SQL - Recommended)

```bash
# Install required dependency
pip install psycopg2-binary

# Run the script
python setup-supabase-sql.py
# or
python3 setup-supabase-sql.py
```

### Required Information

**For REST API scripts** (`setup-supabase.js` and `setup-supabase.py`):
1. **SUPABASE_URL**: Your Supabase project URL (e.g., `https://your-project-id.supabase.co`)
2. **SUPABASE_SERVICE_ROLE_KEY**: Service role key from your Supabase project settings
3. **SUPABASE_ANON_KEY**: Anonymous key from your Supabase project settings
4. **DATABASE_URL**: (Optional) Your database connection string for verification

**For Direct SQL script** (`setup-supabase-sql.py`):
1. **DATABASE_URL**: Full PostgreSQL connection string, OR
2. Individual connection details:
   - Host (e.g., `db.your-project.supabase.co`)
   - Port (usually `5432`)
   - Database name (usually `postgres`)
   - Username (usually `postgres`)
   - Password (your database password)

### How to Get Your Supabase Keys

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** (for SUPABASE_URL)
   - **anon/public** key (for SUPABASE_ANON_KEY)
   - **service_role** key (for SUPABASE_SERVICE_ROLE_KEY)

### Database URL (Optional)

If you want the DATABASE_URL:
1. In Supabase, go to **Settings** → **Database**
2. Scroll to **Connection string**
3. Copy the **URI** format
4. Replace `[YOUR-PASSWORD]` with your database password

## What the Scripts Do

All scripts will:

1. ✅ Enable the pgvector extension for vector embeddings
2. ✅ Create all required tables (users, notebooks, documents, etc.)
3. ✅ Set up proper indexes for performance
4. ✅ Create vector similarity search indexes
5. ✅ Insert sample data including:
   - Demo user account
   - Sample notebook
   - Welcome note

## Verification

After running any script, you can verify the setup by:

1. Going to **Table Editor** in your Supabase dashboard
2. Checking that all tables exist:
   - `users`
   - `notebooks` 
   - `documents`
   - `document_vectors`
   - `chat_history`
   - `notes`
   - `sessions`

3. Verifying sample data exists in the tables

## Troubleshooting

### Permission Errors
- Make sure you're using the **service_role** key, not the anon key
- Verify your Supabase project has the correct permissions

### Network Errors
- Check your internet connection
- Verify the SUPABASE_URL is correct
- Ensure your firewall allows HTTPS connections

### Extension Errors
- The pgvector extension should be automatically available in Supabase
- If you see extension errors, contact Supabase support

## Security Note

- Never commit your actual API keys to version control
- The service role key has full database access - keep it secure
- Consider rotating keys periodically for production use