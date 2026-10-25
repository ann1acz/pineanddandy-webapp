import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Pine & Dandy | Your recipe collection" },
    { name: "description", content: "A personal home for your favourite recipes." },
  ];
}

export default function Home() {
  return (
    <main className="page hero">
      <p className="eyebrow">Pine &amp; Dandy</p>
      <h1>Good food.<br />All in one place.</h1>
      <p>Your own recipe collection, saved privately and ready whenever you cook.</p>
      <div className="actions">
        <Link className="button" to="/auth/signup">Create an account</Link>
        <Link className="button secondary" to="/auth/login">Log in</Link>
        <Link to="/recipes">My recipes</Link>
      </div>
    </main>
  );
}
