import { Link, useLocation } from "react-router";
import logo from "../images/logotext.png";
import searchIcon from "../images/search_icon.png";
import "../styles/header.css";

export function Header() {
  const searching = useLocation().pathname === "/search";
  return (
    <header className="site-header">
      <Link className="header-brand" to="/" aria-label="Pine & Dandy home">
        <img src={logo} alt="Pine & Dandy. A little knowledge, plenty of possibility." />
      </Link>
      {!searching && <Link className="header-search" to="/search" aria-label="Search recipes">
        <img src={searchIcon} alt="" />
      </Link>}
    </header>
  );
}
