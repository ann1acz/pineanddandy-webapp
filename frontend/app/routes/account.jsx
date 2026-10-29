import { Outlet, useNavigation } from "react-router";
import { api } from "../lib/api";
import "../styles/account.css";

export async function clientLoader() {
  // Load the profile before showing the account pages.
  return { profile: await api("/profile") };
}

export default function Account() {
  // Show a busy state while a page inside the account section is loading.
  const busy = useNavigation().state !== "idle";
  return (
    // Outlet shows whichever account page is open, like the profile page.
    <main className="account-page" aria-busy={busy}><Outlet /></main>
  );
}
