import { data, Form, Link, redirect, useNavigation } from "react-router";
import { api, ApiError } from "../lib/api";
import { RecipeCard } from "../components/recipe-card";
import { useState } from "react";
import louisePhoto from "../images/louise.png";
import editIcon from "../images/edit_icon.png";
import badge1 from "../images/badges/badge 1.png";
import badge2 from "../images/badges/badge 2.png";
import badge3 from "../images/badges/badge 3.png";
import badge4 from "../images/badges/badge 4.png";
import badge5 from "../images/badges/badge 5.png";
import "../styles/profile.css";

const profileBadges = [badge1, badge2, badge3, badge4, badge5];

export async function clientLoader() {
  // Load the profile, its recipes and bookmarks at the same time.
  const [profile, recipes, bookmarks] = await Promise.all([api("/profile"), api("/recipes"), api("/bookmarks")]);
  return { profile, recipes, bookmarks };
}

export async function clientAction({ request }) {
  const form = await request.formData();
  try {
    // The logout button uses this same action, but skips saving the profile.
    if (form.get("intent") === "logout") {
      await api("/auth/logout", { method: "POST" });
      return redirect("/login");
    }
    // Save the profile details from the form.
    await api("/profile", {
      method: "PATCH",
      body: JSON.stringify(Object.fromEntries(form)),
    });
    return { error: null, saved: true };
  } catch (error) {
    // Show server errors in the form, but let unexpected errors reach the error page.
    if (error instanceof ApiError) {
      return data({ error: error.message, saved: false }, { status: error.status });
    }
    throw error;
  }
}

export default function ProfilePage({ loaderData, actionData }) {
  const busy = useNavigation().state !== "idle";
  const { profile } = loaderData;
  // Keep the chosen photo here for a preview before the profile is saved.
  const [photo, setPhoto] = useState(profile.profile_photo ?? "");
  const [photoError, setPhotoError] = useState("");
  const [reading, setReading] = useState(false);
  const [editing, setEditing] = useState(false);


  // this is for uploading a new profile photo
  async function choosePhoto(event) {
    const file = event.target.files[0];
    // Reset the input so the same file can be picked again.
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    setEditing(true);
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
    <section className="profile-page">
      <div className="profile-page-heading">
        <h1>Profile</h1>
        <button
          className="profile-settings-button"
          type="button"
          aria-label={editing ? "Close profile settings" : "Edit profile details"}
          aria-expanded={editing}
          aria-controls="profile-edit-fields"
          // takes the user to the profile edit fields when clicked
          onClick={() => setEditing((current) => !current)}
        >
          {/* i dont know why the ai made the gear from scratch but whatever works slay i guess */}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
            <path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .8v.2a1.8 1.8 0 0 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.8l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.8-3h-.2a1.8 1.8 0 0 1 0-3.6h.2a1.8 1.8 0 0 0 .8-3l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.8v-.2a1.8 1.8 0 0 1 3.6 0v.2a1.8 1.8 0 0 0 3 .8l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .8 3h.2a1.8 1.8 0 0 1 0 3.6h-.2a1.8 1.8 0 0 0-.8 3Z" />
          </svg>
        </button>
      </div>

      {/* this form is for editing the profile details */}
      <Form method="post" className="profile-form">
        <input type="hidden" name="profile_photo" value={photo} />
        <div className="profile-summary">
          <div className="profile-avatar-wrap">
            <img className="profile-avatar" src={photo || louisePhoto} alt={`${profile.display_name}'s profile`} />
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
          <div className="profile-details">
            <h2>{profile.display_name}</h2>
            <p className="profile-username">@{profile.username}</p>
            <p className="profile-badges-label">Badges</p>
            <ul className="profile-badges" aria-label="Badges">
              {profileBadges.map((badge, index) => (
                <li key={badge}>
                  <img src={badge} alt={`Achievement badge ${index + 1}`} />
                </li>
              ))}
            </ul>
          </div>
          <label className="profile-photo-edit" htmlFor="profile-photo-input" aria-label="Choose profile photo" title="Choose profile photo">
            <img src={editIcon} alt="" />
          </label>
        </div>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}

        <div id="profile-edit-fields" className="profile-edit-fields" hidden={!editing}>
          <p className="muted">{profile.email}</p>
          <p id="profile-photo-help" className="muted">
              JPEG, PNG or WebP, up to 1 MB. Choose a photo, then save your profile.
          </p>
          {photo && <button type="button" className="secondary" disabled={busy || reading} onClick={() => { setPhoto(""); setPhotoError(""); }}>Remove photo</button>}
          {reading && <p role="status">
            Reading photo...
          </p>}
          {photoError && <p className="error" role="alert">{photoError}</p>}
          <label>Display name<input name="display_name" defaultValue={profile.display_name} maxLength={80} required /></label>
          <label>Username<input name="username" defaultValue={profile.username} autoComplete="username" minLength={3} maxLength={40} pattern="[A-Za-z0-9_]{3,40}" title="3-40 letters, numbers or underscores" required /></label>
          <label>Bio<textarea name="bio" defaultValue={profile.bio} maxLength={1000} rows={5} /></label>
          {actionData?.error && <p className="error" role="alert">{actionData.error}</p>}
          {actionData?.saved && <p role="status">
            Profile saved.
          </p>}
          <button disabled={busy || reading}>{busy ? "Saving..." : "Save profile"}</button>
        </div>
      </Form>
      <section className="profile-section" aria-labelledby="my-recipes-heading">
        <div className="profile-section-heading">
          <h2 id="my-recipes-heading">
            My recipes
          </h2>
          <Link className="profile-add-recipe" to="/recipes/new">
            Add new 
            <span aria-hidden="true">
              ＋
            </span>
          </Link>
        </div>
        {loaderData.recipes.length ? loaderData.recipes.map((recipe) => <div key={recipe.id}><p className="muted">{recipe.visibility === "public" ? "Public" : "Private"}</p><RecipeCard recipe={recipe} showEdit showAuthor={false} /></div>) : <p className="profile-empty">
          You have not added any recipes yet.
        </p>}
      </section>
      <section className="profile-section profile-bookmarks" aria-labelledby="bookmarked-recipes-heading">
        <div className="profile-section-heading">
          <h2 id="bookmarked-recipes-heading">
            Bookmarked recipes
          </h2>
        </div>
        {loaderData.bookmarks.length ? loaderData.bookmarks.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} showEdit />) : <p>Recipes you bookmark will appear here.</p>}
      </section>
      <Form method="post" className="logout">
        <button className="secondary" name="intent" value="logout" disabled={busy}>Log out</button>
      </Form>
    </section>
  );
}
