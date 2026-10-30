import { useId, useRef } from "react";
import { Form, useNavigation } from "react-router";
import settingsIcon from "../images/settngs_icon.png";
import accountIcon from "../images/settingsicon/account.png";
import notificationIcon from "../images/settingsicon/notification.png";
import appearanceIcon from "../images/settingsicon/appearance.png";
import safetyIcon from "../images/settingsicon/safety.png";
import aboutIcon from "../images/settingsicon/about.png";
import "../styles/settings-popup.css";

// the settings popup menu items, they do not lead anywhere yet
const settingsItems = [
  ["Account", accountIcon],
  ["Notifications", notificationIcon],
  ["Appearance", appearanceIcon],
  ["Safety", safetyIcon],
  ["About", aboutIcon],
];

// The cog button and the settings popup it opens.
export function SettingsPopup() {
  const dialog = useRef(null);
  const titleId = useId();
  const busy = useNavigation().state !== "idle";

  return (
    <>
      <button className="profile-settings-button" type="button" aria-haspopup="dialog" aria-label="Open settings" onClick={() => dialog.current.showModal()}>
        <img src={settingsIcon} alt="" aria-hidden="true" />
      </button>
      <dialog className="settings-popup" ref={dialog} aria-labelledby={titleId}>
        <button className="settings-popup-close" type="button" aria-label="Close settings" onClick={() => dialog.current.close()}>×</button>
        <h2 id={titleId}>Settings</h2>
        <ul className="settings-menu">
          {settingsItems.map(([label, icon]) => (
            <li key={label}>
              <button type="button">
                <img src={icon} alt="" />
                {label}
                <span className="settings-arrow" aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ul>
        {/* posts to the profile page action, which handles the logout intent */}
        <Form method="post" className="settings-logout">
          <button name="intent" value="logout" disabled={busy}>Log out</button>
        </Form>
      </dialog>
    </>
  );
}
