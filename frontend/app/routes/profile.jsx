import { data, Link, redirect } from "react-router";
import { api, ApiError } from "../lib/api";
import { RecipeCard } from "../components/recipe-card";
import { SettingsPopup } from "../components/settings-popup";
import { ProfileEditPopup } from "../components/profile-edit-popup";
import louisePhoto from "../images/louise.png";
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
  const { profile } = loaderData;
  return (
    <section className="profile-page">
      <div className="profile-page-heading">
        <h1>Profile</h1>
        {/* the cog button and the settings popup live in this component */}
        <SettingsPopup />
      </div>

      <div className="profile-summary">
        <div className="profile-avatar-wrap">
          <img className="profile-avatar" src={profile.profile_photo || louisePhoto} alt={`${profile.display_name}'s profile`} />
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
        {/* the pencil button and the profile edit popup live in this component */}
        <ProfileEditPopup profile={profile} actionData={actionData} />
      </div>
      <p className="profile-bio-label">Bio</p>
      {profile.bio && <p className="profile-bio">{profile.bio}</p>}

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
    </section>
  );
}
