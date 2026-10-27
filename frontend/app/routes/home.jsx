import { Link, redirect } from "react-router";
import { currentProfile } from "../lib/api";
import "../styles/home.css";

export async function clientLoader() {
  if (!await currentProfile()) throw redirect("/signup");
  return null;
}

export function meta() {
  return [
    { title: "Pine & Dandy | Your recipe collection" },
    { name: "description", content: "A personal home for your favourite recipes." },
  ];
}

export default function Home() {
  return (
    <main className="page home-page">
      <p className="eyebrow">Pine &amp; Dandy</p>
      <h1>Good food.<br />All in one place.</h1>
      <p>Discover recipes from the community and keep your own favourites close at hand.</p>
      <div className="actions">
        <Link className="button" to="/recipes">Explore recipes</Link>
      </div>
    </main>
  );
}
