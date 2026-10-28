import { useEffect, useId, useRef } from "react";
import savedIcon from "../images/saved_icon.png";
import "../styles/saved-popup.css";

export function SavedPopup({ result, message, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (result?.saved && !dialog.current.open) dialog.current.showModal();
  }, [result]);

  return (
    <dialog className="saved-popup" ref={dialog} aria-labelledby={titleId} onClose={onClose}>
      <button className="saved-popup-close" type="button" aria-label="Close confirmation" onClick={() => dialog.current.close()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19" /></svg>
      </button>
      <h2 id={titleId}>{message}</h2>
      <img className="saved-popup-icon" src={savedIcon} alt="" />
      <button className="saved-popup-okay" type="button" autoFocus onClick={() => dialog.current.close()}>Okay</button>
    </dialog>
  );
}
