import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Pool is only created when DATABASE_URL is present (production / Supabase).
// Local dev without a DB falls back to MemStorage — pool stays null.
export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // In production (Netlify/Vercel) or when using Supabase, enable SSL with loose cert check
      ssl: process.env.NODE_ENV === "production" || process.env.DATABASE_URL.includes("supabase")
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;
