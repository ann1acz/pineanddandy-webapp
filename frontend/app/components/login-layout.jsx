import { Link } from "react-router";
import logo from "../images/logotext.png";
import decoration from "../images/edgedecoration.png";
import "../styles/auth.css";

export function LoginLayout({ title, children, signup = false }) {
  return (
    <main className="auth-page">
      <img className="auth-decoration" src={decoration} alt="" />
      <section className="auth-content" aria-labelledby="auth-heading">
        <Link className="auth-logo" to="/" aria-label="Pine & Dandy home">
          <img src={logo} alt="Pine & Dandy. A little knowledge, plenty of possibility." />
        </Link>
        <h1 id="auth-heading" className="sr-only">{title}</h1>
        {children}
        <p className="auth-switch">{signup ? "Already have an account?" : "New here?"}{" "}
          <Link to={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Sign up"}</Link>
        </p>
      </section>
      <img className="auth-decoration auth-decoration-bottom" src={decoration} alt="" />
    </main>
  );
}
