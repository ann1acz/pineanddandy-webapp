import { Form, Link, redirect, useNavigation } from "react-router";
import { api, formError } from "../lib/api";
import { BookmarkButton } from "../components/bookmark-button";
import { useState } from "react";
import { recipeLines } from "../lib/recipe-lines";
import backIcon from "../images/back_icon.png";
import userIcon from "../images/mynaui_user.png";
import cookIcon from "../images/cook_icon.png";
import plantIcon from "../images/plant_icon.png";
import dishIcon from "../images/dish_icon.png";
import seasonIcon from "../images/season_icon.png";
import "../styles/recipe-card.css";
import "../styles/recipe.css";

export async function clientLoader({ params }) {
  return { recipe: await api(`/recipes/${params.recipeId}`) };
}

export async function clientAction({ params }) {
  try {
    await api(`/recipes/${params.recipeId}`, { method: "DELETE" });
    return redirect("/recipes");
  } catch (error) {
    return formError(error);
  }
}

export default function RecipePage({ loaderData, actionData }) {
  const { recipe } = loaderData;
  const busy = useNavigation().state !== "idle";
  const [shareMessage, setShareMessage] = useState("");
  async function shareRecipe() {
    setShareMessage("");
    try {
      if (navigator.share) {
        await navigator.share({ title: recipe.title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareMessage("Recipe link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareMessage("Could not share the link. Copy the address from your browser instead.");
    }
  }
  return (
    <article className="recipe-page">
      <div className="recipe-topbar">
        <Link to="/recipes" aria-label="Back to recipes"><img src={backIcon} alt="" /></Link>
        <p>{recipe.title}</p>
        {recipe.is_owner ? <details className="recipe-owner-menu">
          <summary aria-label="Recipe options">···</summary>
          <div>
            <Link to={`/recipes/${recipe.id}/edit`}>Edit recipe</Link>
            <Form method="post" onSubmit={(event) => {
              if (!window.confirm("Permanently delete this recipe?")) event.preventDefault();
            }}>
              <button className="danger" disabled={busy}>{busy ? "Deleting..." : "Delete recipe"}</button>
            </Form>
          </div>
        </details> : <span />}
      </div>
      <div className="recipe-author"><img className={recipe.author_photo ? "has-photo" : undefined} src={recipe.author_photo || userIcon} alt="" /><div><p>{recipe.author_name}</p><span>@{recipe.author_username}</span>{recipe.visibility !== "public" && <span className="recipe-private-note">Private recipe · Only you</span>}</div></div>
      <ul className="recipe-detail-tags" aria-label="Recipe information">
        <li><img src={cookIcon} alt="" />{recipe.cook_minutes} mins</li>
        {[
          { tags: recipe.plant_types, icon: plantIcon, type: "plant" },
          { tags: recipe.dish_types, icon: dishIcon, type: "dish" },
          { tags: recipe.seasons, icon: seasonIcon, type: "season" },
        ].flatMap(({ tags, icon, type }) => (tags ?? []).map((tag, index) => <li key={`${type}:${index}`}><img src={icon} alt="" />{tag}</li>))}
        {(recipe.dietary_restrictions ?? []).map((tag, index) => <li key={`diet:${index}`}>{tag}</li>)}
      </ul>
      <h1>{recipe.title}</h1>
      {recipe.photos?.length > 0 && <div className="recipe-gallery">{recipe.photos.map((photo, index) => <img key={index} src={photo} alt={`${recipe.title}, photo ${index + 1}`} />)}</div>}
      {recipe.description && <p className="preserve-lines">{recipe.description}</p>}
      {actionData?.error && <p className="error" role="alert">{actionData.error}</p>}
      <section className="recipe-detail-section"><h2>Ingredients</h2><ul className="recipe-ingredients">{recipeLines(recipe.ingredients).map((line, index) => <li key={index}>{line}</li>)}</ul></section>
      <section className="recipe-detail-section"><h2>Instructions</h2><ol className="recipe-instructions">{recipeLines(recipe.instructions).map((line, index) => <li key={index}>{line}</li>)}</ol></section>
      <div className="recipe-footer-actions">
        <BookmarkButton recipe={recipe} />
        {recipe.visibility === "public" && <button className="recipe-share" type="button" onClick={shareRecipe} aria-label="Share recipe">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="18" cy="4" r="3" /><circle cx="5" cy="12" r="3" /><circle cx="18" cy="20" r="3" /><path d="m8 10 7-4M8 14l7 4" /></svg>
        </button>}
      </div>
      {shareMessage && <p role="status">{shareMessage}</p>}
      <time className="recipe-timestamp" dateTime={recipe.created_at}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(recipe.created_at))} UTC</time>
    </article>
  );
}
