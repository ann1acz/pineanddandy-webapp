import { data, Form, Link, redirect, useNavigation } from "react-router";
import { api, ApiError } from "../lib/api";
import { RecipeCard } from "../components/recipe-card";
import { useState } from "react";
import userIcon from "../images/mynaui_user.png";
import "../styles/profile.css";

export async function clientLoader() {
  const [profile, recipes, bookmarks] = await Promise.all([api("/profile"), api("/recipes"), api("/bookmarks")]);
  return { profile, recipes, bookmarks };
}

export async function clientAction({ request }) {
  const form = await request.formData();
  try {
    if (form.get("intent") === "logout") {
      await api("/auth/logout", { method: "POST" });
      return redirect("/login");
    }
    await api("/profile", {
      method: "PATCH",
      body: JSON.stringify(Object.fromEntries(form)),
    });
    return { error: null, saved: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return data({ error: error.message, saved: false }, { status: error.status });
    }
    throw error;
  }
}

export default function ProfilePage({ loaderData, actionData }) {
  const busy = useNavigation().state !== "idle";
  const { profile } = loaderData;
  const [photo, setPhoto] = useState(profile.profile_photo ?? "");
  const [photoError, setPhotoError] = useState("");
  const [reading, setReading] = useState(false);

  async function choosePhoto(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    setPhotoError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1_048_576) {
      setPhotoError("Choose a JPEG, PNG or WebP photo of at most 1 MB.");
      return;
    }
    setReading(true);
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the photo. Please try again."));
        reader.onabort = () => reject(new Error("Photo selection was interrupted. Please try again."));
        reader.readAsDataURL(file);
      });
      setPhoto(image);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      setPhotoError(error.message);
    } finally {
      setReading(false);
    }
  }
  return (
    <section className="profile-page">
      <h1>Your profile</h1>
      <div className="profile-identity">
        <img className="profile-avatar" src={photo || userIcon} alt="Profile photo" />
        <h2>{profile.display_name}</h2>
        <p>@{profile.username}</p>
      </div>
      <p className="muted">{profile.email}</p>
      <Form method="post" className="stack">
        <input type="hidden" name="profile_photo" value={photo} />
        <label>Profile photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={busy || reading} aria-describedby="profile-photo-help" /></label>
        <p id="profile-photo-help" className="muted">JPEG, PNG or WebP, up to 1 MB. Choose a photo, then Save profile. Your saved photo appears with your public recipes.</p>
        {photo && <button type="button" className="secondary" disabled={busy || reading} onClick={() => { setPhoto(""); setPhotoError(""); }}>Remove photo</button>}
        {reading && <p role="status">Reading photo...</p>}
        {photoError && <p className="error" role="alert">{photoError}</p>}
        <label>Display name<input name="display_name" defaultValue={profile.display_name} maxLength={80} required /></label>
        <label>Username<input name="username" defaultValue={profile.username} autoComplete="username" minLength={3} maxLength={40} pattern="[A-Za-z0-9_]{3,40}" title="3-40 letters, numbers or underscores" required /></label>
        <label>Bio<textarea name="bio" defaultValue={profile.bio} maxLength={1000} rows={5} /></label>
        {actionData?.error && <p className="error" role="alert">{actionData.error}</p>}
        {actionData?.saved && <p role="status">Profile saved.</p>}
        <button disabled={busy || reading}>{busy ? "Saving..." : "Save profile"}</button>
      </Form>
      <Form method="post" className="logout">
        <button className="secondary" name="intent" value="logout" disabled={busy}>Log out</button>
      </Form>
      <section aria-labelledby="my-recipes-heading">
        <h2 id="my-recipes-heading">My recipes</h2>
        <p>Private recipes are visible only to you. Public recipes also appear in the feed.</p>
        <Link to="/recipes/new">Add a recipe</Link>
        {loaderData.recipes.length ? loaderData.recipes.map((recipe) => <div key={recipe.id}><p className="muted">{recipe.visibility === "public" ? "Public" : "Private"}</p><RecipeCard recipe={recipe} showEdit /></div>) : <p>You have not added any recipes yet.</p>}
      </section>
      <section aria-labelledby="bookmarked-recipes-heading">
        <h2 id="bookmarked-recipes-heading">Bookmarked recipes</h2>
        {loaderData.bookmarks.length ? loaderData.bookmarks.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} showEdit />) : <p>Recipes you bookmark will appear here.</p>}
      </section>
    </section>
  );
}
