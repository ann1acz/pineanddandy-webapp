import {
  isRouteErrorResponse,
  Links,
  Link,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import "./styles/app.css";
import { ApiError } from "./lib/api";
import { Navbar } from "./components/navbar";
import { Header } from "./components/header";
import { DisclaimerFooter } from "./components/disclaimer-footer";

export const links = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Londrina+Solid:wght@400&family=Raleway:ital,wght@0,100..900;1,100..900&display=swap",
  },
];

export function Layout({ children }) {
  const { pathname } = useLocation();
  const authPage = pathname === "/login" || pathname === "/signup";
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className={authPage ? "auth-layout" : "app-layout"}>
          {!authPage && <Header />}
          {children}
          <DisclaimerFooter />
          {!authPage && <Navbar />}
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  return <main className="page" role="status">Loading Pine &amp; Dandy...</main>;
}

export function ErrorBoundary({ error }) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (error instanceof ApiError) {
    message = error.status === 404 ? "Not found" : "Request failed";
    details = error.message;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="error-page">
      <h1>{message}</h1>
      <p>{details}</p>
      <p><Link to="/">Back to Pine &amp; Dandy</Link></p>
      {stack && (
        <pre className="error-stack">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
