CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name varchar(80) NOT NULL,
  bio varchar(1000) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_idx ON users(auth_user_id);
UPDATE users SET username = 'user_' || replace(id::text, '-', '') WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);

CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  description varchar(2000) NOT NULL DEFAULT '',
  ingredients text NOT NULL,
  instructions text NOT NULL,
  cook_minutes integer NOT NULL CHECK (cook_minutes BETWEEN 0 AND 10080),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE recipes DROP COLUMN IF EXISTS servings;
ALTER TABLE recipes DROP COLUMN IF EXISTS prep_minutes;

CREATE INDEX IF NOT EXISTS recipes_user_id_idx ON recipes(user_id);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS plant_types jsonb NOT NULL DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS dish_types jsonb NOT NULL DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS seasons jsonb NOT NULL DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS dietary_restrictions jsonb NOT NULL DEFAULT '[]';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'public'));

CREATE TABLE IF NOT EXISTS recipe_bookmarks (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, recipe_id)
);
CREATE INDEX IF NOT EXISTS recipe_bookmarks_recipe_idx ON recipe_bookmarks(recipe_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  title varchar(160) NOT NULL,
  location varchar(160) NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS journal_entries_user_date_idx
  ON journal_entries(user_id, entry_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_guides (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  url text NOT NULL,
  url_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, url_hash)
);
CREATE INDEX IF NOT EXISTS saved_guides_user_created_idx
  ON saved_guides(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_sessions (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions(expire);
