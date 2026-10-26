import { Link } from "react-router";
import { BookmarkButton } from "./bookmark-button";
import userIcon from "../images/mynaui_user.png";
import "../styles/recipe-card.css";

export function RecipeCard({ recipe }) {
  return (
    <article className="feed-card">
      <div className="feed-author"><img className={recipe.author_photo ? "has-photo" : undefined} src={recipe.author_photo || userIcon} alt="" /><div><span>{recipe.author_name}</span><span className="feed-author-username">@{recipe.author_username}</span></div></div>
      {recipe.photos?.[0] && <Link className="feed-photo-link" to={`/recipes/${recipe.id}`}>
        <img className="feed-photo" src={recipe.photos[0]} alt={recipe.title} loading="lazy" />
      </Link>}
      <div className="feed-card-heading">
        <h2><Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link></h2>
        <BookmarkButton recipe={recipe} />
      </div>
      <ul className="feed-tags" aria-label="Recipe information">
        <li>{recipe.cook_minutes} mins</li>
        {[...(recipe.plant_types ?? []), ...(recipe.dish_types ?? []), ...(recipe.seasons ?? [])].map((tag, index) => <li key={`${tag}:${index}`}>{tag}</li>)}
      </ul>
      <p className="feed-bookmark-count">{recipe.bookmark_count} {recipe.bookmark_count === 1 ? "bookmark" : "bookmarks"}</p>
    </article>
  );
}
