import { Form, redirect, useNavigation } from "react-router";
import { LoginLayout } from "../components/login-layout";
import { api, currentProfile, formError } from "../lib/api";
import "../styles/login.css";

export async function clientLoader() {
  // Signed-in users can go straight to the recipe list.
  if (await currentProfile()) throw redirect("/recipes");
  return null;
}

export async function clientAction({ request }) {
  // Read the values submitted by the login form.
  const form = await request.formData();
  try {
    // Send the login details to the server.
    await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    }, false);
    return redirect("/home");
  } catch (error) {
    // Pass the error back so the form can show what went wrong.
    return formError(error);
  }
}

export default function Login({ actionData }) {
  // Keep the button disabled until the login request and navigation finish.
  const busy = useNavigation().state !== "idle";
  return (
    <LoginLayout title="Log in">
      <Form method="post" className="auth-form login-form">
        <label><span className="sr-only">E-mail</span><input type="email" name="email" placeholder="E-mail" autoComplete="email" maxLength={254} required /></label>
        <label><span className="sr-only">Password</span><input type="password" name="password" placeholder="Password" autoComplete="current-password" minLength={12} maxLength={128} aria-describedby="login-password-help" required /></label>
        <p id="login-password-help" className="auth-password-help">Use between 12 and 128 characters.</p>
        {/* actionData holds the result returned by clientAction. */}
        {actionData?.error && <p className="auth-error" role="alert">{actionData.error}</p>}
        <button disabled={busy}>{busy ? "Please wait..." : "Log in"}</button>
      </Form>
    </LoginLayout>
  );
}
