import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Did you forget to add Supabase credentials?",
  );
}

// Supabase client for vector operations and other advanced features
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Use the user-provided PostgreSQL connection string
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.ocezhqpybrwlowsfivau:Postgres321@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

export const pool = new Pool({ 
  connectionString: databaseUrl,
  max: 20, // Increase connection pool size
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 20000, // 20 seconds connection timeout
});

export const db = drizzle(pool, { schema });