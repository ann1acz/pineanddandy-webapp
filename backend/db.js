import pg from "pg";

export async function restrictBrowserAccess(client) {
  const { rows } = await client.query(
    "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')",
  );
  for (const role of ["anon", "authenticated"]) {
    if (rows.some(({ rolname }) => rolname === role)) {
      await client.query(`REVOKE ALL ON TABLE public.users, public.recipes,
      public.recipe_bookmarks, public.journal_entries, public.saved_guides, public.user_sessions FROM ${role}`);
    }
  }
}

export function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.");
  }
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  pool.on("error", (error) => console.error("Unexpected PostgreSQL pool error:", error));
  return pool;
}
