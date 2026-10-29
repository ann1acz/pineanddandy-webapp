import { Link } from "react-router";
import signpost from "../images/fourohfourgraphic.png";
import "../styles/fourohfour.css";

export function meta() {
  return [
    { title: "Page not found | Pine & Dandy" },
    {
      name: "description",
      content: "This path does not lead anywhere. Let's head back.",
    },
  ];
}


export default function FourOhFour() {
  return (
    <main className="not-found-page">
      <section className="not-found-content" aria-labelledby="not-found-title">
        <h1 id="not-found-title">Wrong trail!</h1>
        <img
          className="not-found-signpost"
          src={signpost}
          alt="A wooden trail sign marked 404"
        />
        <p>
          This path does not lead anywhere.
          <br />
          Let's head back
        </p>
        <Link className="not-found-home-link" to="/home.jsx">
          Go back home
        </Link>
      </section>
    </main>
  );
}