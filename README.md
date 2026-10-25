# Pine & Dandy

A private recipe collection with user accounts and editable profiles.

The architecture follows the React Router frontend / Express API / PostgreSQL
separation demonstrated by
[chatbot-react-postgres](https://github.com/bewildergeist/chatbot-react-postgres).
This is an original implementation for recipes, not a copy of its chatbot code.
There are no chat, AI, or Supabase SDK dependencies.

## Structure

```text
app/                  React Router SPA frontend (kept in its existing location)
  components/         Shared recipe form
  lib/api.ts          Same-origin API client and error handling
  routes/             Sign-up, login, profile and recipe pages
backend/
  app.ts              Express API, session authentication and ownership checks
  server.ts           API startup and production frontend serving
  db.ts               PostgreSQL connection pool
  passwords.ts        Salted scrypt password hashing
  validation.ts       Server-side input validation
  schema.sql          Users, recipes and persistent sessions
  migrate.ts          Transactional, repeatable initial schema setup
  app.test.ts         API integration tests
shared/types.ts       Frontend/backend data contracts
```

The frontend intentionally uses React Router **SPA mode**, with `clientLoader`
and `clientAction` calling Express rather than a second SSR server. Development
uses Vite's `/api` proxy; production Express serves both API and `build/client`.
Browser cookies stay same-origin and database credentials never enter browser code.

## Local setup (PowerShell)

Requires **Node.js 24+** and an accessible **PostgreSQL** database.

1. Install PostgreSQL locally and create an empty `pineanddandy` database using
   pgAdmin, or provision a hosted PostgreSQL database.
2. Install dependencies and create your local environment file:

   ```powershell
   npm install
   Copy-Item .env.example .env
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

3. Edit `.env`: set `DATABASE_URL` to your PostgreSQL connection string and paste
   the generated value into `SESSION_SECRET`. URL-encode special characters in
   database passwords. Use the TLS options required by your provider; do not
   disable certificate verification. Neither value should have a `VITE_` prefix.
   Never commit this file.
4. Create the tables and start both processes:

   ```powershell
   npm run db:migrate
   npm run dev
   ```

5. Open the URL printed by Vite (normally `http://localhost:5173`). Create an
   account, edit your profile, then add recipes. Recipes are private to their owner.

`PORT` defaults to `3001` for Express; the Vite proxy expects that port. If you
change it, update the proxy target in `vite.config.ts` too.

Supabase may also be used **as the PostgreSQL host** by supplying its database
connection string (not its project API URL or publishable key). Authentication
here is implemented by this API, not Supabase Auth. Keep these tables out of
public Data API access: this schema relies on Express ownership checks, not RLS
policies for browser access. Use a database/schema that is not exposed by that API,
or revoke `anon` and `authenticated` privileges before storing real data.

## Data and authentication

- Users: email, password hash, display name, biography and creation timestamp.
  Email is normalized to lowercase. Profile editing changes display name and bio.
- Recipes: owner, title, description, ingredients, instructions, servings,
  preparation/cooking time and timestamps. Ingredients and instructions are
  multiline text. Every recipe query is scoped to the authenticated user.
- Sessions: stored in PostgreSQL, with a seven-day HttpOnly, SameSite=Lax cookie.
  Login rotates the session ID; logout removes the server-side session.
- Passwords: 12-128 characters, stored only as salted scrypt hashes.
- Mutations: JSON requests require an application-specific header and no
  cross-origin CORS permissions are granted. Authentication endpoints are rate
  limited. Production cookies require HTTPS.

Password reset, email verification, account deletion and multi-instance rate
limiting are not implemented. Add these before a public launch. The current rate
limiter is in-memory per server process.

## API

All responses are JSON except successful logout/delete (204). Errors have
`{ "error": "message" }`. Mutations require `X-Requested-With: pineanddandy` and,
when sending a body, `Content-Type: application/json`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create account and session (`email`, `password`, `display_name`) |
| POST | `/api/auth/login` | Log in (`email`, `password`) |
| POST | `/api/auth/logout` | Destroy session |
| GET | `/api/profile` | Current profile |
| PATCH | `/api/profile` | Update `display_name` and `bio` |
| GET | `/api/recipes` | List own recipes |
| POST | `/api/recipes` | Create a recipe |
| GET | `/api/recipes/:id` | Read own recipe |
| PUT | `/api/recipes/:id` | Replace editable recipe fields |
| DELETE | `/api/recipes/:id` | Delete own recipe |

Recipe writes require `title`, `description` (may be empty), `ingredients`,
`instructions`, `servings`, `prep_minutes`, and `cook_minutes`. Numeric fields must
be integers: servings 1-100, times 0-10080 minutes. User IDs are taken from the
session, never trusted from request input.

## Validation

```powershell
npm test
npm run typecheck
npm run build
```

Tests run the actual Express routes against `pg-mem`, with an isolated in-memory
session store and no external credentials. They cover authentication, hashed
passwords, profile editing, recipe CRUD, cross-user isolation, malformed input
and parameterized SQL. This emulator does not replace a real PostgreSQL smoke
test: run the schema and exercise the app against your configured database too,
including PostgreSQL-backed session persistence across server restarts.
The schema setup is repeatable for the initial schema, not a versioned migration
framework; future schema changes need explicit migrations.

## Production

```powershell
npm run build
# Configure DATABASE_URL and SESSION_SECRET in your hosting environment.
$env:NODE_ENV = "production"
npm run db:migrate
npm start
```

Deploy behind **one trusted HTTPS reverse proxy**, forwarding the original
protocol. Do not expose the Node port directly: production trusts one proxy hop.
Express serves both the frontend and API on `PORT` (default 3001).

The Dockerfile builds the frontend and packages the API. Set `DATABASE_URL` and
`SESSION_SECRET` at runtime, run `npm run db:migrate` as a release step, and provide
HTTPS via your hosting platform. The container listens on port 3000. Do not bake
credentials into the image.
