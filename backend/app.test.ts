import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, test } from "node:test";
import session from "express-session";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import request from "supertest";
import { createApp } from "./app.ts";
import { hashPassword, verifyPassword } from "./passwords.ts";

const secret = "test-only-session-secret-not-for-deployment";
const header = ["X-Requested-With", "pineanddandy"] as const;
const alice = { email: "alice@example.test", password: "correct horse battery staple", display_name: "Alice" };
const bob = { ...alice, email: "bob@example.test", display_name: "Bob" };
const recipe = {
  title: "Lemon pasta",
  description: "A quick dinner",
  ingredients: "200g pasta\n1 lemon",
  instructions: "Boil pasta.\nAdd lemon.",
  servings: 2,
  prep_minutes: 5,
  cook_minutes: 12,
};
let pool: Pool;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  const db = newDb();
  db.public.none(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  const adapter = db.adapters.createPg();
  pool = new adapter.Pool();
  app = createApp({
    pool,
    sessionSecret: secret,
    store: new session.MemoryStore(),
  });
});
afterEach(async () => { await pool.end(); });

test("passwords use salted hashes and verify without storing plaintext", async () => {
  const first = await hashPassword(alice.password);
  const second = await hashPassword(alice.password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(alice.password, first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
});

test("sign-up persists a profile and establishes a session, login and logout work", async () => {
  const agent = request.agent(app);
  const signup = await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  assert.equal(signup.body.email, alice.email);
  assert.equal(signup.body.password_hash, undefined);
  const cookies = signup.headers["set-cookie"];
  assert.match(String(cookies), /HttpOnly/);
  assert.match(String(cookies), /SameSite=Lax/);
  const stored = await pool.query("SELECT password_hash FROM users");
  assert.notEqual(stored.rows[0].password_hash, alice.password);
  await agent.get("/api/profile").expect(200);
  await agent.post("/api/auth/logout").set(...header).expect(204);
  await agent.get("/api/profile").expect(401);
  await agent.post("/api/auth/login").set(...header).send({ ...alice, email: "ALICE@example.test" }).expect(200);
  await agent.get("/api/profile").expect(200);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(409);
});

test("login rejects wrong credentials and nonexistent accounts", async () => {
  await request(app).post("/api/auth/register").set(...header).send(alice).expect(201);
  await request(app).post("/api/auth/login").set(...header).send({ ...alice, password: "wrong password 1234" }).expect(401);
  await request(app).post("/api/auth/login").set(...header).send(bob).expect(401);
});

test("private endpoints require login and mutations require the application header", async () => {
  await request(app).get("/api/recipes").expect(401);
  await request(app).get("/api/profile").expect(401);
  await request(app).post("/api/recipes").set(...header).send(recipe).expect(401);
  await request(app).post("/api/auth/register").send(alice).expect(403);
  await request(app).post("/api/auth/logout").expect(403);
});

test("users can create, read, update and delete their own recipes", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  const created = await agent.post("/api/recipes").set(...header).send(recipe).expect(201);
  const id: string = created.body.id;
  const listed = await agent.get("/api/recipes").expect(200);
  assert.equal(listed.body.length, 1);
  const read = await agent.get(`/api/recipes/${id}`).expect(200);
  assert.equal(read.body.title, recipe.title);
  const edited = await agent.put(`/api/recipes/${id}`).set(...header).send({ ...recipe, title: "Extra lemon pasta" }).expect(200);
  assert.equal(edited.body.title, "Extra lemon pasta");
  await agent.delete(`/api/recipes/${id}`).set(...header).expect(204);
  await agent.get(`/api/recipes/${id}`).expect(404);
  assert.deepEqual((await agent.get("/api/recipes").expect(200)).body, []);
});

test("another user cannot list, read, update or delete private recipes", async () => {
  const owner = request.agent(app);
  const other = request.agent(app);
  await owner.post("/api/auth/register").set(...header).send(alice).expect(201);
  await other.post("/api/auth/register").set(...header).send(bob).expect(201);
  const created = await owner.post("/api/recipes").set(...header).send(recipe).expect(201);
  const id: string = created.body.id;
  assert.deepEqual((await other.get("/api/recipes").expect(200)).body, []);
  await other.get(`/api/recipes/${id}`).expect(404);
  await other.put(`/api/recipes/${id}`).set(...header).send(recipe).expect(404);
  await other.delete(`/api/recipes/${id}`).set(...header).expect(404);
  await owner.get(`/api/recipes/${id}`).expect(200);
});

test("profile updates are scoped to the signed-in user and do not expose password hashes", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  const updated = await agent.patch("/api/profile").set(...header)
    .send({ display_name: "Alice Cook", bio: "I love baking.", email: bob.email }).expect(200);
  assert.equal(updated.body.display_name, "Alice Cook");
  assert.equal(updated.body.bio, "I love baking.");
  assert.equal(updated.body.email, alice.email);
  assert.equal(updated.body.password_hash, undefined);
  assert.equal((await agent.get("/api/profile").expect(200)).body.bio, "I love baking.");
});

test("input validation rejects malformed profiles, recipes and IDs", async () => {
  await request(app).post("/api/auth/register").set(...header).send({ ...alice, password: "short" }).expect(400);
  await request(app).post("/api/auth/register").set(...header).send({ ...alice, email: "not-an-email" }).expect(400);
  const agent = request.agent(app);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  for (const invalid of [
    { ...recipe, title: " " },
    { ...recipe, ingredients: "" },
    { ...recipe, servings: 0 },
    { ...recipe, servings: 1.5 },
    { ...recipe, prep_minutes: -1 },
    { ...recipe, cook_minutes: 10081 },
    { ...recipe, title: "x".repeat(161) },
  ]) {
    await agent.post("/api/recipes").set(...header).send(invalid).expect(400);
  }
  await agent.get("/api/recipes/not-a-uuid").expect(400);
  await agent.patch("/api/profile").set(...header).send({ display_name: "", bio: "" }).expect(400);
  await agent.post("/api/recipes").set(...header).set("Content-Type", "application/json").send("{").expect(400);
  assert.deepEqual((await agent.get("/api/recipes").expect(200)).body, []);
});

test("SQL-like input remains data and cannot change ownership", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  const title = "'; DROP TABLE users; --";
  const result = await agent.post("/api/recipes").set(...header)
    .send({ ...recipe, title, user_id: "00000000-0000-0000-0000-000000000000" }).expect(201);
  assert.equal(result.body.title, title);
  const profile = await agent.get("/api/profile").expect(200);
  assert.equal(result.body.user_id, profile.body.id);
});
