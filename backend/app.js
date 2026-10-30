import { createHash, randomUUID } from "node:crypto";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import { AuthenticationError } from "./supabase-auth.js";
import { emailInput, InputError, journalEntryInput, objectBody, passwordInput, profilePhotoInput, recipeInput, savedGuideInput, text, usernameInput } from "./validation.js";

const PgStore = connectPgSimple(session);
const profileColumns = "id, email, display_name, username, bio, profile_photo";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Start a fresh session after login and save the user's details in it.
async function signIn(request, userId, tokens) {
  await new Promise((resolve, reject) => {
    request.session.regenerate((error) => error ? reject(error) : resolve());
  });
  request.session.userId = userId;
  request.session.supabase = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
  };
  await new Promise((resolve, reject) => {
    request.session.save((error) => error ? reject(error) : resolve());
  });
}

export function createApp({
  pool,
  sessionSecret,
  production = false,
  store,
  auth,
}) {
  // Check that the app has the settings it needs before starting.
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  if (!auth) throw new Error("A Supabase authentication provider is required.");
  const app = express();
  // Trust the HTTPS proxy when the app is running in production.
  if (production) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // Add basic safety headers and prevent other sites from sending API requests.
  app.use("/api", (_request, response, next) => {
    response.set("Cache-Control", "no-store");
    response.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use("/api", (request, response, next) => {
    // Cross-origin pages cannot set this header without a successful CORS preflight.
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
        request.get("X-Requested-With") !== "pineanddandy") {
      response.status(403).json({ error: "Requests must originate from the application." });
      return;
    }
    next();
  });
  app.use("/api", express.json({ limit: "5mb" }));
  // Store login sessions in the database and keep the session cookie secure.
  app.use("/api", session({
    name: "pineanddandy.sid",
    secret: sessionSecret,
    store: store ?? new PgStore({ pool, tableName: "user_sessions" }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: production,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }));
  // Limit repeated attempts to register or log in.
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many authentication attempts. Try again in 15 minutes." },
  });
  // Create a user account after checking the submitted details and email.
  app.post("/api/auth/register", authLimit, async (request, response) => {
    const body = objectBody(request.body);
    const email = emailInput(body);
    const password = passwordInput(body);
    const username = usernameInput(body);
    const displayName = body.display_name === undefined ? username : text(body, "display_name", 80);
    const existing = await pool.query("SELECT id FROM users WHERE email = $1 OR username = $2", [email, username]);
    if (existing.rows.length) {
      response.status(409).json({ error: "This email or username is already in use." });
      return;
    }
    const tokens = await auth.register({ email, password, username, displayName });
    const verified = await auth.validate(tokens);
    if (verified.user.email?.toLowerCase() !== email || !verified.user.email_confirmed_at) {
      throw new AuthenticationError("A verified email is required.", 403);
    }
    let profile;
    try {
      const result = await pool.query(
        `INSERT INTO users (id, email, auth_user_id, display_name, username)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${profileColumns}`,
        [randomUUID(), email, verified.user.id, displayName, username],
      );
      profile = result.rows[0];
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        response.status(409).json({ error: "This email or username is already in use." });
        return;
      }
      throw error;
    }
    await signIn(request, profile.id, verified.session);
    response.status(201).json(profile);
  });

  // Sign in and load the user's profile from the database.
  app.post("/api/auth/login", authLimit, async (request, response) => {
    const body = objectBody(request.body);
    const email = emailInput(body);
    const password = passwordInput(body);
    const tokens = await auth.login({ email, password });
    const verified = await auth.validate(tokens);
    let result = await pool.query(
      `SELECT ${profileColumns} FROM users WHERE auth_user_id = $1`, [verified.user.id],
    );
    if (!result.rows[0]) {
      // Recover a completed Auth signup if the subsequent profile insert failed.
      // Never attach an existing profile merely because its email matches.
      if (!verified.user.email_confirmed_at || verified.user.email?.toLowerCase() !== email) {
        throw new AuthenticationError("A verified email is required.", 403);
      }
      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length) {
        throw new AuthenticationError("This email already belongs to an unlinked profile. Contact the project owner.", 409);
      }
      const metadata = objectBody(verified.user.user_metadata);
      const username = usernameInput(metadata);
      try {
        result = await pool.query(
          `INSERT INTO users (id, email, auth_user_id, display_name, username)
           VALUES ($1, $2, $3, $4, $5) RETURNING ${profileColumns}`,
          [randomUUID(), email, verified.user.id, text(metadata, "display_name", 80), username],
        );
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "23505") {
          throw new AuthenticationError("This email or username is already in use. Contact the project owner.", 409);
        }
        throw error;
      }
    }
    await signIn(request, result.rows[0].id, verified.session);
    response.json(result.rows[0]);
  });

  // Sign out of the auth service and remove the saved session.
  app.post("/api/auth/logout", async (request, response) => {
    let logoutError;
    try {
      await auth.logout(request.session.supabase);
    } catch (error) {
      logoutError = error;
    }
    await new Promise((resolve, reject) => {
      request.session.destroy((error) => error ? reject(error) : resolve());
    });
    response.clearCookie("pineanddandy.sid", {
      httpOnly: true, sameSite: "lax", secure: production,
    });
    if (logoutError) throw logoutError;
    response.status(204).end();
  });

  // Check the saved login before allowing access to the rest of the API.
  app.use("/api", async (request, response, next) => {
    if (!request.session.userId || !request.session.supabase) {
      response.status(401).json({ error: "Please log in to continue." });
      return;
    }
    const verified = await auth.validate(request.session.supabase);
    const result = await pool.query(
      `SELECT ${profileColumns} FROM users WHERE id = $1 AND auth_user_id = $2`,
      [request.session.userId, verified.user.id],
    );
    if (!result.rows[0]) {
      response.status(401).json({ error: "Your account is no longer available. Please log in again." });
      return;
    }
    response.locals.profile = result.rows[0];
    request.session.supabase = {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      expires_at: verified.session.expires_at,
    };
    next();
  });

  // Return the signed-in user's profile.
  app.get("/api/profile", (_request, response) => {
    response.json(response.locals.profile);
  });
  // Save profile changes and report if the username is already taken.
  app.patch("/api/profile", async (request, response) => {
    const body = objectBody(request.body);
    const username = body.username === undefined ? response.locals.profile.username : usernameInput(body);
    const photo = body.profile_photo === undefined ? response.locals.profile.profile_photo : profilePhotoInput(body.profile_photo);
    try {
      const result = await pool.query(
        `UPDATE users SET display_name = $1, bio = $2, username = $4, profile_photo = $5 WHERE id = $3 RETURNING ${profileColumns}`,
        [text(body, "display_name", 80), text(body, "bio", 1000, false), request.session.userId, username, photo],
      );
      response.json(result.rows[0]);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        response.status(409).json({ error: "This username is already in use." });
        return;
      }
      throw error;
    }
  });

  // Return only recipes owned by the signed-in user.
  app.get("/api/recipes", async (request, response) => {
    const recipes = await sharedRecipes(request.session.userId);
    response.json(recipes.filter((recipe) => recipe.is_owner));
  });
  // Load recipes the user is allowed to see, with their bookmark details.
  async function sharedRecipes(userId, recipeId, bookmarkedOnly = false) {
    const result = await pool.query(
      `SELECT recipes.*, users.display_name AS author_name, users.username AS author_username,
       users.profile_photo AS author_photo FROM recipes
       JOIN users ON users.id = recipes.user_id
       WHERE (recipes.visibility = 'public' OR recipes.user_id = $1)
       ${recipeId ? "AND recipes.id = $2" : ""}
       ORDER BY recipes.created_at DESC, recipes.id`,
      recipeId ? [userId, recipeId] : [userId],
    );
    const bookmarks = await pool.query(
      `SELECT recipe_bookmarks.user_id, recipe_bookmarks.recipe_id FROM recipe_bookmarks
       JOIN recipes ON recipes.id = recipe_bookmarks.recipe_id
       WHERE recipes.visibility = 'public' OR recipes.user_id = $1`, [userId],
    );
    const counts = new Map();
    const saved = new Set();
    for (const bookmark of bookmarks.rows) {
      counts.set(bookmark.recipe_id, (counts.get(bookmark.recipe_id) ?? 0) + 1);
      if (bookmark.user_id === userId) saved.add(bookmark.recipe_id);
    }
    return result.rows.filter((recipe) => !bookmarkedOnly || saved.has(recipe.id)).map((recipe) => ({
      ...recipe,
      // Lists only show the first photo, so skip sending the rest of the large photo data.
      photos: recipeId ? recipe.photos : recipe.photos.slice(0, 1),
      bookmark_count: counts.get(recipe.id) ?? 0,
      bookmarked: saved.has(recipe.id),
      is_owner: recipe.user_id === userId,
    }));
  }
  // Show public recipes in the community feed.
  app.get("/api/feed", async (request, response) => {
    const recipes = await sharedRecipes(request.session.userId);
    const feed = recipes.filter((recipe) => recipe.visibility === "public");
    // Pages can ask for only the newest few recipes instead of downloading the whole feed.
    const limit = Number(request.query.limit);
    response.json(Number.isInteger(limit) && limit > 0 ? feed.slice(0, limit) : feed);
  });
  // Show the recipes the user has bookmarked.
  app.get("/api/bookmarks", async (request, response) => {
    response.json(await sharedRecipes(request.session.userId, undefined, true));
  });
  // Return only journal entries owned by the signed-in user.
  app.get("/api/journal-entries", async (request, response) => {
    const result = await pool.query(
      `SELECT id, entry_date, title, location, notes, created_at, updated_at
       FROM journal_entries WHERE user_id = $1
       ORDER BY entry_date DESC, created_at DESC, id`,
      [request.session.userId],
    );
    response.json(result.rows);
  });
  // Save a new journal entry for the signed-in user.
  app.post("/api/journal-entries", async (request, response) => {
    const entry = journalEntryInput(request.body);
    const result = await pool.query(
      `INSERT INTO journal_entries (id, user_id, entry_date, title, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, entry_date, title, location, notes, created_at, updated_at`,
      [randomUUID(), request.session.userId, entry.entry_date, entry.title, entry.location, entry.notes],
    );
    response.status(201).json(result.rows[0]);
  });
  // Check journal entry IDs before using them in database queries.
  app.use("/api/journal-entries/:entryId", (request, response, next) => {
    if (!uuidPattern.test(request.params.entryId)) {
      response.status(400).json({ error: "Invalid journal entry ID." });
      return;
    }
    next();
  });
  // Update a journal entry only when it belongs to the signed-in user.
  app.put("/api/journal-entries/:entryId", async (request, response) => {
    const entry = journalEntryInput(request.body);
    const result = await pool.query(
      `UPDATE journal_entries
       SET entry_date = $1, title = $2, location = $3, notes = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6
       RETURNING id, entry_date, title, location, notes, created_at, updated_at`,
      [entry.entry_date, entry.title, entry.location, entry.notes, request.params.entryId, request.session.userId],
    );
    if (!result.rows[0]) {
      response.status(404).json({ error: "Journal entry not found." });
      return;
    }
    response.json(result.rows[0]);
  });
  // Return only guide links saved by the signed-in user.
  app.get("/api/saved-guides", async (request, response) => {
    const result = await pool.query(
      `SELECT id, title, url, created_at FROM saved_guides
       WHERE user_id = $1 ORDER BY created_at DESC, id`,
      [request.session.userId],
    );
    response.json(result.rows);
  });
  // Save a guide link for the signed-in user.
  app.post("/api/saved-guides", async (request, response) => {
    const guide = savedGuideInput(request.body);
    try {
      const result = await pool.query(
        `INSERT INTO saved_guides (id, user_id, title, url, url_hash)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, title, url, created_at`,
        [randomUUID(), request.session.userId, guide.title, guide.url,
          createHash("sha256").update(guide.url).digest("hex")],
      );
      response.status(201).json(result.rows[0]);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        response.status(409).json({ error: "This guide is already saved." });
        return;
      }
      throw error;
    }
  });
  // Check saved guide IDs before using them in database queries.
  app.use("/api/saved-guides/:guideId", (request, response, next) => {
    if (!uuidPattern.test(request.params.guideId)) {
      response.status(400).json({ error: "Invalid saved guide ID." });
      return;
    }
    next();
  });
  // Remove a saved guide link only when it belongs to the signed-in user.
  app.delete("/api/saved-guides/:guideId", async (request, response) => {
    const result = await pool.query(
      "DELETE FROM saved_guides WHERE id = $1 AND user_id = $2 RETURNING id",
      [request.params.guideId, request.session.userId],
    );
    if (!result.rows[0]) {
      response.status(404).json({ error: "Saved guide not found." });
      return;
    }
    response.status(204).end();
  });
  // Save a new recipe and return it to the frontend.
  app.post("/api/recipes", async (request, response) => {
    const recipe = recipeInput(request.body);
    // $1, $2, etc. match the values in the list below. RETURNING * gives back the saved recipe.
    const result = await pool.query(
      `INSERT INTO recipes
       (id, user_id, title, description, ingredients, instructions, cook_minutes,
        photos, plant_types, dish_types, seasons, dietary_restrictions, visibility)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [randomUUID(), request.session.userId, recipe.title, recipe.description,
        recipe.ingredients, recipe.instructions, recipe.cook_minutes,
        JSON.stringify(recipe.photos), JSON.stringify(recipe.plant_types), JSON.stringify(recipe.dish_types),
        JSON.stringify(recipe.seasons), JSON.stringify(recipe.dietary_restrictions), recipe.visibility],
    );
    response.status(201).json(result.rows[0]);
  });

  // Check recipe IDs before using them in database queries.
  app.use("/api/recipes/:recipeId", (request, response, next) => {
    if (!uuidPattern.test(request.params.recipeId)) {
      response.status(400).json({ error: "Invalid recipe ID." });
      return;
    }
    next();
  });
  // Return one recipe if the user is allowed to see it.
  app.get("/api/recipes/:recipeId", async (request, response) => {
    const recipes = await sharedRecipes(request.session.userId, request.params.recipeId);
    if (!recipes[0]) {
      response.status(404).json({ error: "Recipe not found." });
      return;
    }
    response.json(recipes[0]);
  });
  // Add a bookmark if the recipe is public or belongs to the user.
  app.put("/api/recipes/:recipeId/bookmark", async (request, response) => {
    const result = await pool.query(
      `INSERT INTO recipe_bookmarks (user_id, recipe_id)
       SELECT $1, id FROM recipes WHERE id = $2 AND (visibility = 'public' OR user_id = $1)
       ON CONFLICT (user_id, recipe_id) DO NOTHING RETURNING recipe_id`,
      [request.session.userId, request.params.recipeId],
    );
    if (!result.rows.length) {
      const visible = await sharedRecipes(request.session.userId, request.params.recipeId);
      if (!visible.length) {
        response.status(404).json({ error: "Recipe not found." });
        return;
      }
    }
    response.status(204).end();
  });
  // Remove the user's bookmark from a recipe.
  app.delete("/api/recipes/:recipeId/bookmark", async (request, response) => {
    await pool.query("DELETE FROM recipe_bookmarks WHERE user_id = $1 AND recipe_id = $2",
      [request.session.userId, request.params.recipeId]);
    response.status(204).end();
  });
  // Update a recipe only when it belongs to the signed-in user.
  app.put("/api/recipes/:recipeId", async (request, response) => {
    const recipe = recipeInput(request.body);
    const result = await pool.query(
      `UPDATE recipes SET title = $1, description = $2, ingredients = $3, instructions = $4,
       cook_minutes = $5,
       photos = $6, plant_types = $7, dish_types = $8, seasons = $9, dietary_restrictions = $10, visibility = $11,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 AND user_id = $13 RETURNING *`,
      [recipe.title, recipe.description, recipe.ingredients, recipe.instructions,
        recipe.cook_minutes, JSON.stringify(recipe.photos),
        JSON.stringify(recipe.plant_types), JSON.stringify(recipe.dish_types),
        JSON.stringify(recipe.seasons), JSON.stringify(recipe.dietary_restrictions), recipe.visibility,
        request.params.recipeId, request.session.userId,
      ],
    );
    if (!result.rows[0]) {
      response.status(404).json({ error: "Recipe not found." });
      return;
    }
    response.json(result.rows[0]);
  });
  // Delete a recipe only when it belongs to the signed-in user.
  app.delete("/api/recipes/:recipeId", async (request, response) => {
    const result = await pool.query(
      "DELETE FROM recipes WHERE id = $1 AND user_id = $2 RETURNING id",
      [request.params.recipeId, request.session.userId],
    );
    if (!result.rows[0]) {
      response.status(404).json({ error: "Recipe not found." });
      return;
    }
    response.status(204).end();
  });
  // Return a clear error for API paths that do not exist.
  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "API endpoint not found." });
  });
  // Turn known errors into useful responses and log unexpected ones.
  const handleError = (error, _request, response, _next) => {
    if (error instanceof AuthenticationError) {
      response.status(error.status).json({ error: error.message });
    } else if (error instanceof InputError) {
      response.status(400).json({ error: error.message });
    } else if (error instanceof SyntaxError && "status" in error && error.status === 400) {
      response.status(400).json({ error: "Invalid JSON request body." });
    } else if (error instanceof Error && "status" in error && error.status === 413) {
      response.status(413).json({ error: "Request body is too large." });
    } else {
      console.error("API request failed:", error);
      response.status(500).json({ error: "The server could not complete your request. Please try again." });
    }
  };
  app.use(handleError);
  return app;
}
