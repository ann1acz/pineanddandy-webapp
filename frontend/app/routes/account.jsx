import { NavLink, Outlet, useNavigation } from "react-router";
import { api } from "../lib/api";

export async function clientLoader() {
  return { profile: await api("/profile") };
}

export default function Account({ loaderData }) {
  const busy = useNavigation().state !== "idle";
  return (
    <>
      <header className="site-header">
        <NavLink className="brand" to="/">Pine &amp; Dandy</NavLink>
        <nav aria-label="Account">
          <NavLink to="/recipes">My recipes</NavLink>
          <NavLink to="/profile">Profile ({loaderData.profile.display_name})</NavLink>
        </nav>
      </header>
      <main className="page" aria-busy={busy}><Outlet /></main>
    </>
  );
}
