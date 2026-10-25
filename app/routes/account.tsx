import { NavLink, Outlet, useNavigation } from "react-router";
import type { Route } from "./+types/account";
import type { Profile } from "../../shared/types";
import { api } from "../lib/api";

export async function clientLoader() {
  return { profile: await api<Profile>("/profile") };
}

export default function Account({ loaderData }: Route.ComponentProps) {
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
