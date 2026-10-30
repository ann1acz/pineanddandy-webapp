# Backend and Supabase Auth

The React SPA calls the Express API. Supabase Auth handles passwords and issues
access/refresh tokens. Express stores those tokens in PostgreSQL-backed sessions,
not in browser localStorage or frontend JavaScript. The browser receives only an
HTTP-only session-ID cookie. On protected requests Express verifies the Supabase
identity, refreshes expired tokens and enforces recipe/profile ownership.

## Local configuration

Keep the following in the root `.env` (never commit it):

- `DATABASE_URL`: the Supabase PostgreSQL connection.
- `SUPABASE_URL`: the HTTPS project URL for that same project.
- `SUPABASE_PUBLISHABLE_KEY`: publishable key, or legacy anon key.
- `SESSION_SECRET`: a random secret of at least 32 characters.
- `PORT`: API port (default 3001).
- `NODE_ENV`: `development` locally; `production` behind HTTPS.

## Demo email setting

In Supabase Authentication, open the Email provider and disable **Confirm email**.
This project intentionally uses immediate signup/login for demo accounts, including
non-deliverable email addresses. If confirmation is enabled, signup reports an
explicit configuration error instead of pretending the user is logged in.
Email confirmation and self-service password recovery are not implemented here;
configure and implement those before using this demo publicly.

## Database setup

Run `npm run db:migrate` from the repository root before starting the API on a
fresh project, and whenever an application update adds or changes database
tables. This migration is safe to rerun and preserves existing account and
recipe data. It also revokes browser-role access to the application tables.

## Checks

From the repository root, `npm test` tests API permissions, identity mapping,
Supabase token refresh and error handling using mocks.
`npm run build` validates the frontend. These do not create real Auth users.
