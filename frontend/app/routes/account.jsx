import { Outlet, useNavigation } from "react-router";
import { api } from "../lib/api";
import "../styles/account.css";

export async function clientLoader() {
  return { profile: await api("/profile") };
}

export default function Account() {
  const busy = useNavigation().state !== "idle";
  return (
    <main className="account-page" aria-busy={busy}><Outlet /></main>
  );
}
