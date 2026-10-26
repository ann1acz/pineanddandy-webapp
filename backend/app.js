import { randomUUID } from "node:crypto";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { rateLimit } from "express-rate-limit";
import { hashPassword, verifyPassword } from "./passwords.js";
import { emailInput, InputError, objectBody, passwordInput, recipeInput, text } from "./validation.js";

const PgStore = connectPgSimple(session);
const profileColumns = "id, email, display_name, bio";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signIn(request, userId) {
  await new Promise((resolve, reject) => {
    request.session.regenerate((error) => error ? reject(error) : resolve());
  });
  request.session.userId = userId;
  await new Promise((resolve, reject) => {
    request.session.save((error) => error ? reject(error) : resolve());
  });
}

export function createApp({
  pool,
  sessionSecret,
  production = false,
  store,
}) {
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  const app = express();
  // Production is expected to sit behind exactly one trusted HTTPS reverse proxy.
  if (production) app.set("trust proxy", 1);
  app.disable("x-powered-by");
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
  app.use("/api", express.json({ limit: "80kb" }));
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
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many authentication attempts. Try again in 15 minutes." },
  });
  const dummyHash = hashPassword(randomUUID());

  app.post("/api/auth/register", authLimit, async (request, response) => {
    const body = objectBody(request.body);
    const email = emailInput(body);
    const password = passwordInput(body);
    const displayName = text(body, "display_name", 80);
    let profile;
    try {
      const result = await pool.query(
        `INSERT INTO users (id, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4) RETURNING ${profileColumns}`,
        [randomUUID(), email, await hashPassword(password), displayName],
      );
      profile = result.rows[0];
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        response.status(409).json({ error: "An account with this email already exists." });
        return;
      }
      throw error;
    }
    await signIn(request, profile.id);
    response.status(201).json(profile);
  });

  app.post("/api/auth/login", authLimit, async (request, response) => {
    const body = objectBody(request.body);
    const email = emailInput(body);
    const password = passwordInput(body);
    const result = await pool.query(
      `SELECT ${profileColumns}, password_hash FROM users WHERE email = $1`, [email],
    );
    const user = result.rows[0];
    const valid = await verifyPassword(password, user?.password_hash ?? await dummyHash);
    if (!user || !valid) {
      response.status(401).json({ error: "Incorrect email or password." });
      return;
    }
    await signIn(request, user.id);
    const { password_hash: _hash, ...profile } = user;
    response.json(profile);
  });

  app.post("/api/auth/logout", async (request, response) => {
    await new Promise((resolve, reject) => {
      request.session.destroy((error) => error ? reject(error) : resolve());
    });
    response.clearCookie("pineanddandy.sid", {
      httpOnly: true, sameSite: "lax", secure: production,
    });
    response.status(204).end();
  });

  app.use("/api", async (request, response, next) => {
    if (!request.session.userId) {
      response.status(401).json({ error: "Please log in to continue." });
      return;
    }
    const result = await pool.query(
      `SELECT ${profileColumns} FROM users WHERE id = $1`, [request.session.userId],
    );
    if (!result.rows[0]) {
      response.status(401).json({ error: "Your account is no longer available. Please log in again." });
      return;
    }
    response.locals.profile = result.rows[0];
    next();
  });

  app.get("/api/profile", (_request, response) => {
    response.json(response.locals.profile);
  });
  app.patch("/api/profile", async (request, response) => {
    const body = objectBody(request.body);
    const result = await pool.query(
      `UPDATE users SET display_name = $1, bio = $2 WHERE id = $3 RETURNING ${profileColumns}`,
      [text(body, "display_name", 80), text(body, "bio", 1000, false), request.session.userId],
    );
    response.json(result.rows[0]);
  });

  app.get("/api/recipes", async (request, response) => {
    const result = await pool.query(
      "SELECT * FROM recipes WHERE user_id = $1 ORDER BY created_at DESC, id", [request.session.userId],
    );
    response.json(result.rows);
  });
  app.post("/api/recipes", async (request, response) => {
    const recipe = recipeInput(request.body);
    const result = await pool.query(
      `INSERT INTO recipes
       (id, user_id, title, description, ingredients, instructions, servings, prep_minutes, cook_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [randomUUID(), request.session.userId, recipe.title, recipe.description,
        recipe.ingredients, recipe.instructions, recipe.servings, recipe.prep_minutes, recipe.cook_minutes],
    );
    response.status(201).json(result.rows[0]);
  });

  app.use("/api/recipes/:recipeId", (request, response, next) => {
    if (!uuidPattern.test(request.params.recipeId)) {
      response.status(400).json({ error: "Invalid recipe ID." });
      return;
    }
    next();
  });
  app.get("/api/recipes/:recipeId", async (request, response) => {
    const result = await pool.query(
      "SELECT * FROM recipes WHERE id = $1 AND user_id = $2",
      [request.params.recipeId, request.session.userId],
    );
    if (!result.rows[0]) {
      response.status(404).json({ error: "Recipe not found." });
      return;
    }
    response.json(result.rows[0]);
  });
  app.put("/api/recipes/:recipeId", async (request, response) => {
    const recipe = recipeInput(request.body);
    const result = await pool.query(
      `UPDATE recipes SET title = $1, description = $2, ingredients = $3, instructions = $4,
       servings = $5, prep_minutes = $6, cook_minutes = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [recipe.title, recipe.description, recipe.ingredients, recipe.instructions,
        recipe.servings, recipe.prep_minutes, recipe.cook_minutes, request.params.recipeId, request.session.userId],
    );
    if (!result.rows[0]) {
      response.status(404).json({ error: "Recipe not found." });
      return;
    }
    response.json(result.rows[0]);
  });
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
  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "API endpoint not found." });
  });
  const handleError = (error, _request, response, _next) => {
    if (error instanceof InputError) {
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
