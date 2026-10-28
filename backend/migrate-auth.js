import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { createPool, restrictBrowserAccess } from "./db.js";
import { supabaseClient } from "./supabase-auth.js";
import { passwordInput } from "./validation.js";

export async function migrateAccount(pool, admin, profile, password, existingAuthUsers) {
  passwordInput({ password });
  let user = existingAuthUsers.find((candidate) => candidate.email?.toLowerCase() === profile.email.toLowerCase());
  if (user && user.app_metadata?.legacy_profile_id !== profile.id) {
    throw new Error("An unrelated Supabase account already uses this email. Resolve it manually; no accounts were merged.");
  }
  if (!user) {
    const { data, error } = await admin.createUser({
      email: profile.email,
      password,
      email_confirm: true,
      app_metadata: { legacy_profile_id: profile.id },
    });
    if (error) throw error;
    user = data.user;
    existingAuthUsers.push(user);
  } else {
    const { error } = await admin.updateUserById(user.id, { password, email_confirm: true });
    if (error) throw error;
  }
  // Never change the application ID: recipe ownership and bookmarks reference it.
  await pool.query(
    "UPDATE users SET auth_user_id = $1 WHERE id = $2 AND auth_user_id IS NULL",
    [user.id, profile.id],
  );
}

function hiddenPassword(prompt) {
  if (!process.stdin.isTTY) throw new Error("Run this command in an interactive VS Code terminal.");
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(error) {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }
    function onKey(text, key) {
      if (key?.ctrl && key.name === "c") return finish(new Error("Migration cancelled."));
      if (key?.name === "return") return finish();
      if (key?.name === "backspace") value = value.slice(0, -1);
      else if (text && !key?.ctrl && !key?.meta) value += text;
    }
    process.stdin.on("keypress", onKey);
  });
}

async function main() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY locally in .env.");
  const admin = supabaseClient(key).auth.admin;
  const settings = await fetch(new URL("/auth/v1/settings", process.env.SUPABASE_URL), {
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY },
    signal: AbortSignal.timeout(15_000),
  });
  if (!settings.ok) throw new Error(`Could not check Supabase settings (${settings.status}).`);
  if (!(await settings.json()).mailer_autoconfirm) {
    throw new Error("For this demo, turn OFF Confirm email in Supabase → Authentication → Email before migrating.");
  }
  const authUsers = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    authUsers.push(...data.users);
    if (data.users.length < 100) break;
  }
  const pool = createPool();
  try {
    // Keep an application-data backup outside the repository before any writes.
    const client = await pool.connect();
    let backup;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      backup = {};
      for (const table of ["users", "recipes", "recipe_bookmarks"]) {
        backup[table] = (await client.query(`SELECT * FROM ${table}`)).rows;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const directory = join(homedir(), ".pineanddandy-backups");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const path = join(directory, `before-supabase-auth-${randomUUID()}.json`);
    await writeFile(path, JSON.stringify(backup), { mode: 0o600, flag: "wx" });
    console.log(`Application-data backup saved to ${path}. Keep it private; it includes legacy password hashes.`);
    const confirmation = createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try {
      answer = await confirmation.question("Stop the app first. Type MIGRATE to create/link Supabase accounts: ");
    } finally {
      confirmation.close();
    }
    if (answer !== "MIGRATE") throw new Error("Migration cancelled; no database changes made.");
    await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
    // Only Express accesses these tables; browser Supabase keys must not read them.
    await restrictBrowserAccess(pool);
    const profiles = (await pool.query("SELECT id, email FROM users WHERE auth_user_id IS NULL ORDER BY created_at")).rows;
    for (const profile of profiles) {
      console.log(`Migrating ${profile.email}`);
      const password = await hiddenPassword("New password (12-128 characters; hidden): ");
      const repeat = await hiddenPassword("Repeat password: ");
      if (password !== repeat) throw new Error("Passwords do not match. Rerun to continue; migrated accounts are skipped.");
      await migrateAccount(pool, admin, profile, password, authUsers);
      console.log("Account linked. Existing profile, recipes and bookmarks preserved.");
    }
    await pool.query("DELETE FROM user_sessions");
    console.log("Migration complete. Restart the app and log in with the new passwords.");
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Authentication migration stopped:", error.message);
    process.exitCode = 1;
  });
}
