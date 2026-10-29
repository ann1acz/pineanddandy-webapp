import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, test } from "node:test";
import session from "express-session";
import { newDb } from "pg-mem";
import request from "supertest";
import { createApp } from "./app.js";
import { AuthenticationError } from "./supabase-auth.js";
import { migrateAccount } from "./migrate-auth.js";
import { InputError, recipeInput } from "./validation.js";

const secret = "test-only-session-secret-not-for-deployment";
const header = ["X-Requested-With", "pineanddandy"];
const alice = { email: "alice@example.test", password: "correct horse battery staple", display_name: "Alice", username: "alice_cooks" };
const bob = { ...alice, email: "bob@example.test", display_name: "Bob", username: "bob_cooks" };
const recipe = {
  title: "Lemon pasta",
  description: "A quick dinner",
  ingredients: "200g pasta\n1 lemon",
  instructions: "Boil pasta.\nAdd lemon.",
  prep_minutes: 5,
  cook_minutes: 12,
};
let pool;
let app;
let auth;
let identities;
let tokens;

beforeEach(async () => {
  const db = newDb();
  db.public.registerFunction({
    name: "replace",
    args: ["text", "text", "text"],
    returns: "text",
    implementation: (value, from, to) => value.replaceAll(from, to),
  });
  db.public.none(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
  const adapter = db.adapters.createPg();
  pool = new adapter.Pool();
  identities = new Map();
  tokens = new Map();
  function issue(user) {
    const session = {
      user,
      access_token: randomUUID(),
      refresh_token: randomUUID(),
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    tokens.set(session.access_token, session);
    return session;
  }
  auth = {
    async register({ email, password, username, displayName }) {
      if (identities.has(email)) throw new AuthenticationError("Email already registered.", 409);
      const user = {
        id: randomUUID(), email, email_confirmed_at: new Date().toISOString(),
        user_metadata: { username, display_name: displayName },
      };
      identities.set(email, { user, password });
      return issue(user);
    },
    async login({ email, password }) {
      const identity = identities.get(email);
      if (!identity || identity.password !== password) throw new AuthenticationError("Incorrect email or password.");
      return issue(identity.user);
    },
    async validate(session) {
      if (!tokens.has(session?.access_token)) throw new AuthenticationError("Session expired.");
      return { user: tokens.get(session.access_token).user, session };
    },
    async logout(session) {
      if (session) tokens.delete(session.access_token);
    },
  };
  app = createApp({
    pool,
    sessionSecret: secret,
    store: new session.MemoryStore(),
    auth,
  });
});
afterEach(async () => { await pool.end(); });

test("sign-up persists a profile and establishes a session, login and logout work", async () => {
  const agent = request.agent(app);
  const signup = await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  assert.equal(signup.body.email, alice.email);
  assert.equal(signup.body.password_hash, undefined);
  const cookies = signup.headers["set-cookie"];
  assert.match(String(cookies), /HttpOnly/);
  assert.match(String(cookies), /SameSite=Lax/);
  const stored = await pool.query("SELECT password_hash FROM users");
  assert.equal(stored.rows[0].password_hash, null);
  assert.equal(signup.body.access_token, undefined);
  assert.equal(signup.body.refresh_token, undefined);
  await agent.get("/api/profile").expect(200);
  await agent.post("/api/auth/logout").set(...header).expect(204);
  await agent.get("/api/profile").expect(401);
  await agent.post("/api/auth/login").set(...header).send({ ...alice, email: "ALICE@example.test" }).expect(200);
  await agent.get("/api/profile").expect(200);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(409);
});

test("sign-up defaults the display name to the username and allows editing it later", async () => {
  const agent = request.agent(app);
  const { display_name, ...account } = alice;
  const signup = await agent.post("/api/auth/register").set(...header)
    .send({ ...account, username: "ALICE_COOKS" }).expect(201);
  assert.equal(signup.body.display_name, "alice_cooks");
  assert.equal(signup.body.username, "alice_cooks");
  const profile = await agent.get("/api/profile").expect(200);
  assert.equal(profile.body.display_name, "alice_cooks");
  await agent.patch("/api/profile").set(...header)
    .send({ display_name: "Alice Cook", username: "alice_cooks", bio: "" }).expect(200);
  const updated = await agent.get("/api/profile").expect(200);
  assert.equal(updated.body.display_name, "Alice Cook");
  assert.equal(updated.body.username, "alice_cooks");
});

test("login rejects wrong credentials and nonexistent accounts", async () => {
  await request(app).post("/api/auth/register").set(...header).send(alice).expect(201);
  await request(app).post("/api/auth/login").set(...header).send({ ...alice, password: "wrong password 1234" }).expect(401);
  await request(app).post("/api/auth/login").set(...header).send(bob).expect(401);
});

test("revoked Supabase tokens cannot access an existing cookie session", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  tokens.clear();
  await agent.get("/api/profile").expect(401);
  await agent.get("/api/recipes").expect(401);
});

test("an authenticated Supabase ID is never linked to a legacy profile by email alone", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  identities.get(alice.email).user = {
    ...identities.get(alice.email).user,
    id: randomUUID(),
  };
  await request(app).post("/api/auth/login").set(...header).send(alice).expect(409);
});

test("login recovers a successful Auth signup whose local profile creation failed", async () => {
  await auth.register({ ...alice, displayName: "Alice" });
  const agent = request.agent(app);
  const login = await agent.post("/api/auth/login").set(...header).send(alice).expect(200);
  assert.equal(login.body.display_name, "Alice");
  assert.equal(login.body.username, alice.username);
  assert.equal((await agent.get("/api/profile").expect(200)).body.id, login.body.id);
});

test("migration preserves profile IDs, recipes and bookmarks and skips unrelated Auth accounts", async () => {
  const agent = request.agent(app);
  const signup = await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  const id = signup.body.id;
  const created = await agent.post("/api/recipes").set(...header).send(recipe).expect(201);
  await agent.put(`/api/recipes/${created.body.id}/bookmark`).set(...header).expect(204);
  await pool.query("UPDATE users SET auth_user_id = NULL, password_hash = $1 WHERE id = $2", ["legacy-hash", id]);
  const profile = { id, email: alice.email };
  const authUsers = [];
  const authId = randomUUID();
  let createdCount = 0;
  const admin = {
    async createUser(input) {
      createdCount++;
      assert.equal(input.email_confirm, true);
      assert.deepEqual(input.app_metadata, { legacy_profile_id: id });
      assert.equal(input.password, alice.password);
      return { data: { user: { id: authId, email: alice.email, app_metadata: input.app_metadata } } };
    },
    async updateUserById(id, input) {
      assert.equal(id, authId);
      assert.equal(input.password, alice.password);
      return { data: {} };
    },
  };
  await assert.rejects(migrateAccount(pool, admin, profile, alice.password, [{
    id: randomUUID(), email: alice.email, app_metadata: {},
  }]), /unrelated/);
  assert.equal(createdCount, 0);
  await migrateAccount(pool, admin, profile, alice.password, authUsers);
  // A retry after a remote create/local database failure reuses only our migration-marked identity.
  await migrateAccount(pool, admin, profile, alice.password, authUsers);
  assert.equal(createdCount, 1);
  const stored = (await pool.query("SELECT * FROM users WHERE id = $1", [id])).rows[0];
  assert.equal(stored.auth_user_id, authId);
  assert.equal(stored.password_hash, "legacy-hash");
  assert.equal(stored.display_name, alice.display_name);
  assert.equal((await pool.query("SELECT user_id FROM recipes")).rows[0].user_id, id);
  assert.equal((await pool.query("SELECT user_id FROM recipe_bookmarks")).rows[0].user_id, id);
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
  const id = created.body.id;
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
  const id = created.body.id;
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

const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

test("profile photos persist, appear with recipes, remain owner-scoped and can be removed", async () => {
  const owner = request.agent(app);
  const other = request.agent(app);
  await owner.post("/api/auth/register").set(...header).send(alice).expect(201);
  await other.post("/api/auth/register").set(...header).send(bob).expect(201);
  const fields = { display_name: alice.display_name, bio: "" };
  await owner.patch("/api/profile").set(...header).send({ ...fields, profile_photo: photo }).expect(200);
  assert.equal((await owner.get("/api/profile").expect(200)).body.profile_photo, photo);
  assert.equal((await other.get("/api/profile").expect(200)).body.profile_photo, "");
  const created = await owner.post("/api/recipes").set(...header).send({ ...recipe, visibility: "public" }).expect(201);
  assert.equal((await other.get("/api/feed").expect(200)).body[0].author_photo, photo);
  assert.equal((await other.get(`/api/recipes/${created.body.id}`).expect(200)).body.author_photo, photo);
  await owner.patch("/api/profile").set(...header).send(fields).expect(200);
  assert.equal((await owner.get("/api/profile").expect(200)).body.profile_photo, photo);
  for (const invalid of [null, 42, "https://example.test/avatar.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,aGVsbG8="]) {
    await owner.patch("/api/profile").set(...header).send({ ...fields, profile_photo: invalid }).expect(400);
  }
  await owner.patch("/api/profile").set(...header).send({ ...fields, profile_photo: "" }).expect(200);
  assert.equal((await other.get("/api/feed").expect(200)).body[0].author_photo, "");
});

test("usernames are normalized, unique and editable and appear with recipe authors", async () => {
  const agent = request.agent(app);
  const registered = await agent.post("/api/auth/register").set(...header).send({ ...alice, username: "ALICE_COOKS" }).expect(201);
  assert.equal(registered.body.username, "alice_cooks");
  await request(app).post("/api/auth/register").set(...header).send({ ...bob, username: "Alice_Cooks" }).expect(409);
  await request(app).post("/api/auth/register").set(...header).send(bob).expect(201);
  for (const username of ["a", "with space", "with-dash", "x".repeat(41), ""]) {
    await agent.patch("/api/profile").set(...header).send({ display_name: "Alice", bio: "", username }).expect(400);
  }
  await agent.patch("/api/profile").set(...header).send({ display_name: "Alice", bio: "", username: "BOB_COOKS" }).expect(409);
  const updated = await agent.patch("/api/profile").set(...header)
    .send({ display_name: "Alice Cook", bio: "", username: "Alice_Forages" }).expect(200);
  assert.equal(updated.body.username, "alice_forages");
  assert.equal((await agent.get("/api/profile").expect(200)).body.username, "alice_forages");
  const created = await agent.post("/api/recipes").set(...header).send({ ...recipe, visibility: "public" }).expect(201);
  const detail = (await agent.get(`/api/recipes/${created.body.id}`).expect(200)).body;
  assert.equal(detail.author_name, "Alice Cook");
  assert.equal(detail.author_username, "alice_forages");
  assert.equal((await agent.get("/api/feed").expect(200)).body[0].author_username, "alice_forages");
});

test("recipe photos and categories persist through create, list, read, edit and removal", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  const extra = {
    photos: [photo],
    plant_types: ["Mushroom", "Herb"],
    dish_types: ["Soup"],
    seasons: ["Autumn"],
    dietary_restrictions: ["Vegan", "Gluten-free"],
  };
  const created = await agent.post("/api/recipes").set(...header).send({ ...recipe, ...extra }).expect(201);
  const id = created.body.id;
  for (const result of [
    created.body,
    (await agent.get("/api/recipes").expect(200)).body[0],
    (await agent.get(`/api/recipes/${id}`).expect(200)).body,
  ]) {
    for (const [key, value] of Object.entries(extra)) assert.deepEqual(result[key], value);
  }
  const updated = await agent.put(`/api/recipes/${id}`).set(...header)
    .send({ ...recipe, ...extra, seasons: ["Spring"], photos: [] }).expect(200);
  assert.deepEqual(updated.body.photos, []);
  assert.deepEqual(updated.body.seasons, ["Spring"]);
  assert.deepEqual(updated.body.plant_types, extra.plant_types);
  const cleared = await agent.put(`/api/recipes/${id}`).set(...header).send(recipe).expect(200);
  for (const key of Object.keys(extra)) assert.deepEqual(cleared.body[key], []);
});

test("recipe uploads and categories reject unsupported, oversized and malformed values", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  for (const extra of [
    { photos: [photo, photo, photo, photo] },
    { photos: ["https://example.test/photo.png"] },
    { photos: ["data:image/svg+xml;base64,PHN2Zz4="] },
    { photos: ["data:image/png;base64,aGVsbG8="] },
    { photos: ["data:image/png;base64," + "A".repeat(1_398_132)] },
    { photos: "not an array" },
    { plant_types: [""] },
    { seasons: Array(13).fill("Spring") },
    { dish_types: [42] },
    { dietary_restrictions: ["x".repeat(61)] },
  ]) {
    await agent.post("/api/recipes").set(...header).send({ ...recipe, ...extra }).expect(400);
  }
  assert.deepEqual((await agent.get("/api/recipes").expect(200)).body, []);
});

test("photo size validation accepts exactly 1 MB and rejects one byte more", () => {
  const bytes = Buffer.alloc(1_048_577);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  const atLimit = `data:image/png;base64,${bytes.subarray(0, 1_048_576).toString("base64")}`;
  const overLimit = `data:image/png;base64,${bytes.toString("base64")}`;
  assert.equal(recipeInput({ ...recipe, photos: [atLimit, atLimit, atLimit] }).photos.length, 3);
  assert.throws(() => recipeInput({ ...recipe, photos: [overLimit] }), InputError);
});

test("recipe schema migration can run again without removing saved recipes", async () => {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").set(...header).send(alice).expect(201);
  const created = await agent.post("/api/recipes").set(...header).send({ ...recipe, photos: [photo] }).expect(201);
  assert.equal(created.body.servings, undefined);
  await pool.query("ALTER TABLE recipes ADD COLUMN servings integer NOT NULL DEFAULT 2");
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  for (const statement of schema.split(";").filter((statement) => statement.trim().startsWith("ALTER TABLE"))) {
    await pool.query(statement);
  }
  const listed = await agent.get("/api/recipes").expect(200);
  assert.equal(listed.body.length, 1);
  assert.deepEqual(listed.body[0].photos, [photo]);
  assert.equal(listed.body[0].servings, undefined);
});

test("public feed shares only published recipes while mutations stay owner-only", async () => {
  const owner = request.agent(app);
  const other = request.agent(app);
  await owner.post("/api/auth/register").set(...header).send(alice).expect(201);
  await other.post("/api/auth/register").set(...header).send(bob).expect(201);
  const privateRecipe = (await owner.post("/api/recipes").set(...header).send(recipe).expect(201)).body;
  const publicRecipe = (await owner.post("/api/recipes").set(...header).send({ ...recipe, visibility: "public" }).expect(201)).body;
  const feed = (await other.get("/api/feed").expect(200)).body;
  assert.equal(feed.length, 1);
  assert.equal(feed[0].id, publicRecipe.id);
  assert.equal(feed[0].author_name, alice.display_name);
  assert.equal(feed[0].is_owner, false);
  assert.equal(feed[0].email, undefined);
  await other.get(`/api/recipes/${privateRecipe.id}`).expect(404);
  await other.get(`/api/recipes/${publicRecipe.id}`).expect(200);
  await other.put(`/api/recipes/${publicRecipe.id}`).set(...header).send(recipe).expect(404);
  await other.delete(`/api/recipes/${publicRecipe.id}`).set(...header).expect(404);
  assert.deepEqual((await other.get("/api/recipes").expect(200)).body, []);
  await owner.put(`/api/recipes/${publicRecipe.id}`).set(...header).send({ ...recipe, visibility: "private" }).expect(200);
  assert.deepEqual((await other.get("/api/feed").expect(200)).body, []);
  await other.get(`/api/recipes/${publicRecipe.id}`).expect(404);
  assert.equal((await owner.get("/api/recipes").expect(200)).body.length, 2);
  await owner.post("/api/recipes").set(...header).send({ ...recipe, visibility: "everyone" }).expect(400);
  await request(app).get("/api/feed").expect(401);
});

test("bookmarks persist per user, count unique users, and never expose private recipes", async () => {
  const owner = request.agent(app);
  const other = request.agent(app);
  await owner.post("/api/auth/register").set(...header).send(alice).expect(201);
  await other.post("/api/auth/register").set(...header).send(bob).expect(201);
  const published = (await owner.post("/api/recipes").set(...header).send({ ...recipe, visibility: "public" }).expect(201)).body;
  const privateRecipe = (await owner.post("/api/recipes").set(...header).send(recipe).expect(201)).body;
  const url = `/api/recipes/${published.id}/bookmark`;
  await other.put(`/api/recipes/${privateRecipe.id}/bookmark`).set(...header).expect(404);
  await request(app).put(url).set(...header).expect(401);
  await other.put(url).expect(403);
  await other.put(url).set(...header).expect(204);
  await other.put(url).set(...header).expect(204);
  let feed = (await other.get("/api/feed").expect(200)).body;
  assert.equal(feed[0].bookmark_count, 1);
  assert.equal(feed[0].bookmarked, true);
  assert.equal((await owner.get("/api/feed").expect(200)).body[0].bookmarked, false);
  assert.equal((await other.get("/api/bookmarks").expect(200)).body[0].id, published.id);
  await owner.put(url).set(...header).expect(204);
  assert.equal((await other.get("/api/feed").expect(200)).body[0].bookmark_count, 2);
  await other.delete(url).set(...header).expect(204);
  assert.equal((await owner.get("/api/feed").expect(200)).body[0].bookmark_count, 1);
  await other.put(url).set(...header).expect(204);
  await owner.put(`/api/recipes/${published.id}`).set(...header).send({ ...recipe, visibility: "private" }).expect(200);
  assert.deepEqual((await other.get("/api/bookmarks").expect(200)).body, []);
  await other.put(url).set(...header).expect(404);
  assert.equal((await owner.get("/api/bookmarks").expect(200)).body.length, 1);
  await owner.delete(`/api/recipes/${published.id}`).set(...header).expect(204);
  assert.equal((await pool.query("SELECT * FROM recipe_bookmarks")).rows.length, 0);
});
