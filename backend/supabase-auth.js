import { createClient } from "@supabase/supabase-js";

export class AuthenticationError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

export function supabaseClient(key = process.env.SUPABASE_PUBLISHABLE_KEY) {
  const url = process.env.SUPABASE_URL;
  if (!url || !key || new URL(url).protocol !== "https:") {
    throw new Error("Configure SUPABASE_URL (HTTPS) and the required Supabase key in .env.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function check(error) {
  if (!error) return;
  if (!error.status || error.status >= 500) {
    console.error("Supabase authentication unavailable:", error.name, error.status);
    throw new AuthenticationError("Login service is unavailable. Please try again.", 503);
  }
  if (error.status === 429) {
    throw new AuthenticationError("Too many attempts. Please try again later.", 429);
  }
  throw new AuthenticationError(
    error.code === "email_not_confirmed"
      ? "Confirm your email before logging in."
      : "Authentication failed. Check your details and try again.",
    error.status === 401 || error.code === "invalid_credentials" ? 401 : 400,
  );
}

export function createSupabaseAuth(makeClient = supabaseClient) {
  // Separate clients prevent one user's session from replacing another's.
  return {
    async register({ email, password, username, displayName }) {
      const { data, error } = await makeClient().auth.signUp({
        email,
        password,
        options: { data: { username, display_name: displayName } },
      });
      check(error);
      if (!data.session || !data.user) {
        throw new AuthenticationError(
          "Signup requires email confirmation. For this demo, turn off Confirm email in Supabase before signing up.",
          409,
        );
      }
      return data.session;
    },
    async login({ email, password }) {
      const { data, error } = await makeClient().auth.signInWithPassword({ email, password });
      check(error);
      return data.session;
    },
    async validate(tokens) {
      if (!tokens?.access_token || !tokens.refresh_token) {
        throw new AuthenticationError("Please log in to continue.");
      }
      const client = makeClient();
      let session = tokens;
      if (tokens.expires_at <= Math.floor(Date.now() / 1000) + 30) {
        const { data, error } = await client.auth.refreshSession({ refresh_token: tokens.refresh_token });
        if (error && error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw new AuthenticationError("Your session expired. Please log in again.");
        }
        check(error);
        if (!data.session) throw new AuthenticationError("Your session expired. Please log in again.");
        session = data.session;
      }
      const { data, error } = await client.auth.getUser(session.access_token);
      if (error && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw new AuthenticationError("Your session expired. Please log in again.");
      }
      check(error);
      if (!data.user) throw new AuthenticationError("Please log in again.");
      return { user: data.user, session };
    },
    async logout(tokens) {
      if (!tokens) return;
      const { error } = await makeClient().auth.admin.signOut(tokens.access_token, "local");
      // An expired or already-revoked session is already logged out.
      if (error && ![401, 403, 404].includes(error.status)) check(error);
    },
  };
}
