import { Link } from "react-router";
import { BookmarkButton } from "./bookmark-button";
import userIcon from "../images/mynaui_user.png";
import editIcon from "../images/edit_icon.png";
import cookIcon from "../images/cook_icon.png";
import plantIcon from "../images/plant_icon.png";
import dishIcon from "../images/dish_icon.png";
import seasonIcon from "../images/season_icon.png";
import "../styles/recipe-card.css";

export function RecipeCard({ recipe, showEdit = false }) {
  return (
    <article className="feed-card">
      <div className="feed-author"><img className={recipe.author_photo ? "has-photo" : undefined} src={recipe.author_photo || userIcon} alt="" /><div><span>{recipe.author_name}</span><span className="feed-author-username">@{recipe.author_username}</span></div></div>
      {recipe.photos?.[0] && <Link className="feed-photo-link" to={`/recipes/${recipe.id}`}>
        <img className="feed-photo" src={recipe.photos[0]} alt={recipe.title} loading="lazy" />
      </Link>}
      <div className="feed-card-heading">
        <h2><Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link></h2>
        {showEdit && recipe.is_owner
          ? <Link className="feed-edit-link" to={`/recipes/${recipe.id}/edit`} aria-label={`Edit ${recipe.title}`}><img src={editIcon} alt="" /></Link>
          : <BookmarkButton recipe={recipe} />}
      </div>
      <ul className="feed-tags" aria-label="Recipe information">
        <li><img src={cookIcon} alt="" />{recipe.cook_minutes} mins</li>
        {[
          { tags: recipe.plant_types, icon: plantIcon, type: "plant" },
          { tags: recipe.dish_types, icon: dishIcon, type: "dish" },
          { tags: recipe.seasons, icon: seasonIcon, type: "season" },
        ].flatMap(({ tags, icon, type }) => (tags ?? []).map((tag, index) => <li key={`${type}:${index}`}><img src={icon} alt="" />{tag}</li>))}
      </ul>
      <p className="feed-bookmark-count">{recipe.bookmark_count} {recipe.bookmark_count === 1 ? "bookmark" : "bookmarks"}</p>
    </article>
  );
}
