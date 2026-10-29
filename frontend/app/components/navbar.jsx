import { NavLink } from "react-router";
import "../styles/navbar.css";
import tentIcon from "../images/mynaui_tent.png";
import cookieIcon from "../images/mynaui_cookie.png";
import journalIcon from "../images/mynaui_book-image.png";
import guidesIcon from "../images/mynaui_book-open.png";
import profileIcon from "../images/mynaui_user.png";

export function Navbar() {
  return (
    <footer className="bottom-nav">
      <nav className="main-nav" aria-label="Main navigation">
        <NavLink className="main-nav-link" to="/" end>
          <span className="nav-icon"><img src={tentIcon} alt="" /></span>
          <span>Home</span>
        </NavLink>
        <NavLink className="main-nav-link" to="/recipes">
          <span className="nav-icon"><img src={cookieIcon} alt="" /></span>
          <span>Recipes</span>
        </NavLink>
        <span className="main-nav-item nav-item-disabled" aria-label="Journal, coming soon" title="Coming soon">
          <span className="nav-icon"><img src={journalIcon} alt="" /></span>
          <span>Journal</span>
        </span>
        <NavLink className="main-nav-link" to="/fourohfour" title="Coming soon">
          <span className="nav-icon"><img src={guidesIcon} alt="" /></span>
          <span>Guides</span>
        </NavLink>
        <NavLink className="main-nav-link" to="/profile">
          <span className="nav-icon"><img src={profileIcon} alt="" /></span>
          <span>Profile</span>
        </NavLink>
      </nav>
    </footer>
  );
}
