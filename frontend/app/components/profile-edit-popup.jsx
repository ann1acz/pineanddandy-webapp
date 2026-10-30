import { useId, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import louisePhoto from "../images/louise.png";
import editIcon from "../images/edit_icon.png";
import saveIcon from "../images/save_icon.png";
import badge1 from "../images/badges/badge 1.png";
import badge2 from "../images/badges/badge 2.png";
import badge3 from "../images/badges/badge 3.png";
import badge4 from "../images/badges/badge 4.png";
import badge5 from "../images/badges/badge 5.png";
import "../styles/profile-edit-popup.css";

const profileBadges = [badge1, badge2, badge3, badge4, badge5];

// The pencil button and the profile edit popup it opens.
export function ProfileEditPopup({ profile, actionData }) {
  const dialog = useRef(null);
  const titleId = useId();
  const busy = useNavigation().state !== "idle";
  // Keep the chosen photo here for a preview before the profile is saved.
  const [photo, setPhoto] = useState(profile.profile_photo ?? "");
  const [photoError, setPhotoError] = useState("");
  const [reading, setReading] = useState(false);

  // this is for uploading a new profile photo
  async function choosePhoto(event) {
    const file = event.target.files[0];
    // Reset the input so the same file can be picked again.
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    // only allow selected image types and limit the size to 1 MB
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1_048_576) {
      setPhotoError("Choose a JPEG, PNG or WebP photo of at most 1 MB.");
      return;
    }
    setReading(true);
    try {
      // turns the file into a string that can be sent to the server and displayed in the browser
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the photo. Please try again."));
        reader.onabort = () => reject(new Error("Photo selection was interrupted. Please try again."));
        reader.readAsDataURL(file);
      });
      setPhoto(image);
      // Clear any previous error, in case the user had selected a bad photo before.
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      setPhotoError(error.message);
    } finally {
      // Re-enable the form whether the photo loaded or failed.
      setReading(false);
    }
  }

  return (
    <>
      <button className="profile-photo-edit" type="button" aria-haspopup="dialog" aria-label="Edit profile details" onClick={() => dialog.current.showModal()}>
        <img src={editIcon} alt="" />
      </button>
      <dialog className="profile-edit-popup" ref={dialog} aria-labelledby={titleId}>
        <button className="profile-edit-popup-close" type="button" aria-label="Close profile editing" onClick={() => dialog.current.close()}>×</button>
        <h2 id={titleId} className="sr-only">Edit profile</h2>
        <Form method="post" className="profile-edit-form">
          <input type="hidden" name="profile_photo" value={photo} />
          <div className="profile-edit-photo">
            <img className="profile-avatar" src={photo || louisePhoto} alt={`${profile.display_name}'s profile`} />
            {/* the pencil on the photo opens the file picker */}
            <label className="profile-edit-photo-button" htmlFor="profile-photo-input" aria-label="Choose profile photo" title="Choose profile photo">
              <img src={editIcon} alt="" />
            </label>
            <input
              id="profile-photo-input"
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={choosePhoto}
              disabled={busy || reading}
              aria-describedby="profile-photo-help"
            />
          </div>
          <p id="profile-photo-help" className="muted">
            JPEG, PNG or WebP, up to 1 MB.
          </p>
          {photo && <button type="button" className="secondary" disabled={busy || reading} onClick={() => { setPhoto(""); setPhotoError(""); }}>Remove photo</button>}
          {reading && <p role="status">
            Reading photo...
          </p>}
          {photoError && <p className="error" role="alert">{photoError}</p>}
          <label>Name<input name="display_name" defaultValue={profile.display_name} maxLength={80} required /></label>
          <label>Username<input name="username" defaultValue={profile.username} autoComplete="username" minLength={3} maxLength={40} pattern="[A-Za-z0-9_]{3,40}" title="3-40 letters, numbers or underscores" required /></label>
          <label>Bio<textarea name="bio" defaultValue={profile.bio} maxLength={1000} rows={5} /></label>
          <p className="profile-badges-label">Badges</p>
          <p className="muted profile-badges-note">(you can display max. 6 on your profile)</p>
          <ul className="profile-edit-badges" aria-label="Badges">
            {profileBadges.map((badge, index) => (
              <li key={badge}>
                <img src={badge} alt={`Achievement badge ${index + 1}`} />
              </li>
            ))}
            {/* empty slots for badges that are not earned yet */}
            {Array.from({ length: 9 }, (_, index) => <li key={index} className="profile-badge-slot" aria-hidden="true">?</li>)}
          </ul>
          {actionData?.error && <p className="error" role="alert">{actionData.error}</p>}
          {actionData?.saved && <p role="status">
            Profile saved.
          </p>}
          <button className="profile-save-button" disabled={busy || reading}>
            <img src={saveIcon} alt="" />
            {busy ? "Saving..." : "Save changes"}
          </button>
        </Form>
      </dialog>
    </>
  );
}
