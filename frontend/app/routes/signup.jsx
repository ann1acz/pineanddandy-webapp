import { data, Form, redirect, useNavigation } from "react-router";
import { LoginLayout } from "../components/login-layout";
import { api, currentProfile, formError } from "../lib/api";
import "../styles/signup.css";

export async function clientLoader() {
  if (await currentProfile()) throw redirect("/recipes");
  return null;
}

export async function clientAction({ request }) {
  const form = await request.formData();
  if (form.get("password") !== form.get("confirm_password")) {
    return data({ error: "Passwords do not match." }, { status: 400 });
  }
  try {
    await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        username: form.get("username"),
      }),
    }, false);
    return redirect("/recipes");
  } catch (error) {
    return formError(error);
  }
}

export default function Signup({ actionData }) {
  const busy = useNavigation().state !== "idle";
  return (
    <LoginLayout title="Sign up" signup>
      <Form method="post" className="auth-form signup-form">
        <label><span className="sr-only">Username</span><input name="username" placeholder="Username" autoComplete="username" minLength={3} maxLength={40} pattern="[A-Za-z0-9_]{3,40}" title="3-40 letters, numbers or underscores" required /></label>
        <label><span className="sr-only">E-mail</span><input type="email" name="email" placeholder="E-mail" autoComplete="email" maxLength={254} required /></label>
        <label><span className="sr-only">Password</span><input type="password" name="password" placeholder="Password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="signup-password-help" required /></label>
        <label><span className="sr-only">Repeat password</span><input type="password" name="confirm_password" placeholder="Repeat password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
        <p id="signup-password-help" className="auth-password-help">Use between 12 and 128 characters.</p>
        {actionData?.error && <p className="auth-error" role="alert">{actionData.error}</p>}
        <button disabled={busy}>{busy ? "Please wait..." : "Sign Up"}</button>
      </Form>
    </LoginLayout>
  );
}
