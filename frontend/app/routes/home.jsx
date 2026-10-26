import { Link } from "react-router";
import "../styles/home.css";

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
        <Link className="button" to="/signup">Create an account</Link>
        <Link className="button secondary" to="/login">Log in</Link>
        <Link to="/recipes">Explore recipes</Link>
      </div>
    </main>
  );
}
