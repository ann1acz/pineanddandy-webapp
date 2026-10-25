import { readFile } from "node:fs/promises";
import { createPool } from "./db.ts";

const pool = createPool();
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  await client.query("COMMIT");
  console.log("Database schema is ready.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
