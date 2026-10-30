import express from "express";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createApp } from "./app.js";
import { createPool } from "./db.js";
import { createSupabaseAuth, supabaseClient } from "./supabase-auth.js";

const pool = createPool();
const production = process.env.NODE_ENV === "production";
supabaseClient();
const app = createApp({
  pool,
  production,
  sessionSecret: process.env.SESSION_SECRET ?? "",
  auth: createSupabaseAuth(),
});
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a whole number between 1 and 65535.");
}

await pool.query("SELECT id, auth_user_id FROM users LIMIT 0");
await pool.query("SELECT id FROM recipes LIMIT 0");
await pool.query("SELECT sid FROM user_sessions LIMIT 0");
try {
  await pool.query("SELECT id FROM journal_entries LIMIT 0");
  await pool.query("SELECT id FROM saved_guides LIMIT 0");
} catch (error) {
  await pool.end();
  throw new Error(
    "The journal database tables are missing. Stop the app, run npm run db:migrate from the repository root, and restart the API.",
    { cause: error },
  );
}

if (production) {
  const clientDirectory = fileURLToPath(new URL("../frontend/build/client", import.meta.url));
  app.use(express.static(clientDirectory));
  app.get("/{*path}", (_request, response) => {
    response.sendFile(join(clientDirectory, "index.html"));
  });
}

const server = app.listen(port, () => {
  console.log(`Pine & Dandy ${production ? "app" : "API"} listening on port ${port}`);
});
function shutdown() {
  server.close(() => {
    pool.end().catch((error) => {
      console.error("Could not close the database pool:", error);
      process.exitCode = 1;
    });
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
