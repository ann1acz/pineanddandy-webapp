import { data, Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/profile";
import type { Profile } from "../../shared/types";
import { api, ApiError } from "../lib/api";

export async function clientLoader() {
  return { profile: await api<Profile>("/profile") };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  try {
    if (form.get("intent") === "logout") {
      await api<void>("/auth/logout", { method: "POST" });
      return redirect("/auth/login");
    }
    await api<Profile>("/profile", {
      method: "PATCH",
      body: JSON.stringify(Object.fromEntries(form)),
    });
    return { error: null, saved: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return data({ error: error.message, saved: false }, { status: error.status });
    }
    throw error;
  }
}

export default function ProfilePage({ loaderData, actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const { profile } = loaderData;
  return (
    <section className="narrow">
      <h1>Your profile</h1>
      <p className="muted">{profile.email}</p>
      <Form method="post" className="stack">
        <label>Display name<input name="display_name" defaultValue={profile.display_name} maxLength={80} required /></label>
        <label>About you<textarea name="bio" defaultValue={profile.bio} maxLength={1000} rows={5} /></label>
        {actionData?.error && <p className="error" role="alert">{actionData.error}</p>}
        {actionData?.saved && <p role="status">Profile saved.</p>}
        <button disabled={busy}>{busy ? "Saving..." : "Save profile"}</button>
      </Form>
      <Form method="post" className="logout">
        <button className="secondary" name="intent" value="logout" disabled={busy}>Log out</button>
      </Form>
    </section>
  );
}
