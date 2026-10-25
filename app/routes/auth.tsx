import { Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/auth";
import { api, currentProfile, formError } from "../lib/api";

function authMode(mode: string | undefined) {
  if (mode !== "login" && mode !== "signup") throw new Response("Not found", { status: 404 });
  return mode;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const mode = authMode(params.mode);
  if (await currentProfile()) throw redirect("/recipes");
  return { mode };
}

export async function clientAction({ params, request }: Route.ClientActionArgs) {
  const mode = authMode(params.mode);
  const form = await request.formData();
  try {
    await api(`/auth/${mode === "signup" ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form)),
    }, false);
    return redirect("/recipes");
  } catch (error) {
    return formError(error);
  }
}

export default function Auth({ loaderData, actionData }: Route.ComponentProps) {
  const signup = loaderData.mode === "signup";
  const busy = useNavigation().state !== "idle";
  return (
    <main className="page narrow">
      <Link className="brand" to="/">Pine &amp; Dandy</Link>
      <h1>{signup ? "Make yourself at home" : "Welcome back"}</h1>
      <Form method="post" className="stack" key={loaderData.mode}>
        {signup && <label>Display name<input name="display_name" autoComplete="nickname" maxLength={80} required /></label>}
        <label>Email<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
        <label>Password<input type="password" name="password" autoComplete={signup ? "new-password" : "current-password"} minLength={12} maxLength={128} required /></label>
        <p className="muted">Use between 12 and 128 characters.</p>
        {actionData?.error && <p className="error" role="alert">{actionData.error}</p>}
        <button disabled={busy}>{busy ? "Please wait..." : signup ? "Create account" : "Log in"}</button>
      </Form>
      <p>{signup ? "Already have an account?" : "New here?"}{" "}
        <Link to={signup ? "/auth/login" : "/auth/signup"}>{signup ? "Log in" : "Create an account"}</Link>
      </p>
    </main>
  );
}
