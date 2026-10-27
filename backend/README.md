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

Migration additionally needs a server-only `SUPABASE_SECRET_KEY`, or the legacy
`SUPABASE_SERVICE_ROLE_KEY`. Never use a `VITE_` prefix for either secret. The
running application does not need this administrative key after migration.

## Demo email setting

In Supabase Authentication, open the Email provider and disable **Confirm email**.
This project intentionally uses immediate signup/login for demo accounts, including
non-deliverable email addresses. If confirmation is enabled, signup reports an
explicit configuration error instead of pretending the user is logged in.
Email confirmation and self-service password recovery are not implemented here;
configure and implement those before using this demo publicly.

## Preserving existing accounts

Stop development/production servers before migration. From the repository root:

```text
npm install
npm run auth:migrate
```

The command:

1. Checks Supabase configuration and administrative access.
2. Saves a consistent JSON backup of users, recipes and bookmarks under
   `~/.pineanddandy-backups/`, outside Git. Keep it private: it contains legacy
   password hashes and user data. This is an application-data backup, not a full
   Supabase project backup. It does not back up database schema, Auth or storage.
3. Asks for `MIGRATE` before changing the database.
4. Adds an `auth_user_id` mapping without changing application user IDs.
5. Restricts the application tables to backend access, not Supabase browser roles.
6. Prompts for a new password twice per unmigrated account, with typing hidden.
7. Creates confirmed Supabase Auth accounts and links them to existing profiles.
8. Clears old login sessions after all accounts are linked.

Profiles, recipe owners and bookmarks keep their existing IDs. Existing hashes
are retained only for rollback planning; application login never uses them.
Passwords now live in Supabase Auth, not the application users table.

The command can be rerun after interruption. Already linked profiles are skipped.
If remote account creation succeeded but linking failed, only a matching
admin-written `legacy_profile_id` marker allows reuse. An unrelated existing
Auth account with the same email is never automatically merged. If such a
conflict occurs, stop and resolve it manually.

After migration run `npm run dev` from the repository root and log in using the
existing account emails and the new passwords. Do not restart the old
authentication implementation against migrated data without a rollback plan.

For a fresh, empty project, run `npm run db:migrate` before starting the API.
Both migration commands revoke browser-role access to the application tables.

## Checks

From the repository root, `npm test` tests API permissions, identity mapping,
migration preservation, Supabase token refresh and error handling using mocks.
`npm run build` validates the frontend. These do not create real Auth users.
