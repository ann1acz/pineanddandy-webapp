import pg from "pg";

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
