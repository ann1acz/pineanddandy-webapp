import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthenticationError, createSupabaseAuth } from "./supabase-auth.js";

const user = { id: "supabase-user", email: "test@example.test" };
const session = { access_token: "access", refresh_token: "refresh", expires_at: 4_000_000_000, user };

test("Supabase handles password signup and login, without persisting SDK sessions", async () => {
  const calls = [];
  const provider = createSupabaseAuth(() => ({
    auth: {
      signUp: async (input) => { calls.push(input); return { data: { session, user } }; },
      signInWithPassword: async (input) => { calls.push(input); return { data: { session } }; },
    },
  }));
  const credentials = { email: user.email, password: "example password" };
  assert.equal(await provider.register({ ...credentials, username: "test_user", displayName: "Test" }), session);
  assert.equal(await provider.login(credentials), session);
  assert.deepEqual(calls, [{
    ...credentials, options: { data: { username: "test_user", display_name: "Test" } },
  }, credentials]);
});

test("expired access tokens refresh on the server and the new identity is verified", async () => {
  const provider = createSupabaseAuth(() => ({
    auth: {
      refreshSession: async (input) => {
        assert.deepEqual(input, { refresh_token: "old-refresh" });
        return { data: { session } };
      },
      getUser: async (token) => {
        assert.equal(token, session.access_token);
        return { data: { user } };
      },
    },
  }));
  assert.deepEqual(await provider.validate({
    access_token: "expired", refresh_token: "old-refresh", expires_at: 0,
  }), { user, session });
});

test("invalid or revoked tokens fail closed; an outage is not treated as a successful login", async () => {
  const provider = createSupabaseAuth(() => ({
    auth: { getUser: async () => ({ error: { status: 403 } }) },
  }));
  await assert.rejects(provider.validate(session), (error) => error instanceof AuthenticationError && error.status === 401);
  await assert.rejects(provider.validate(undefined), AuthenticationError);
  const unavailable = createSupabaseAuth(() => ({
    auth: { signInWithPassword: async () => ({ error: { status: 503, name: "ServiceUnavailable" } }) },
  }));
  await assert.rejects(unavailable.login({}), (error) => error.status === 503);
});

test("confirmation-required signup reports an actionable error, not success", async () => {
  const provider = createSupabaseAuth(() => ({
    auth: { signUp: async () => ({ data: { user, session: null } }) },
  }));
  await assert.rejects(provider.register({}), (error) => error.status === 409 && /Confirm email/.test(error.message));
});

test("logout revokes the Supabase session and accepts an already-expired token", async () => {
  const provider = createSupabaseAuth(() => ({
    auth: { admin: { signOut: async (token, scope) => {
      assert.equal(token, "access");
      assert.equal(scope, "local");
      return { error: { status: 401 } };
    } } },
  }));
  await provider.logout(session);
  await provider.logout(undefined);
});
