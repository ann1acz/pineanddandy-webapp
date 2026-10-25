import { Link } from "react-router";
import type { Route } from "./+types/recipes";
import type { Recipe } from "../../shared/types";
import { api } from "../lib/api";

export async function clientLoader() {
  return { recipes: await api<Recipe[]>("/recipes") };
}

export default function Recipes({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <div className="section-heading">
        <div><p className="eyebrow">Your private collection</p><h1>My recipes</h1></div>
        <Link className="button" to="/recipes/new">Add a recipe</Link>
      </div>
      {loaderData.recipes.length === 0 ? (
        <section className="card"><h2>Something delicious starts here.</h2><p>Add your first recipe to keep it close at hand.</p></section>
      ) : (
        <div className="recipe-grid">
          {loaderData.recipes.map((recipe) => (
            <article className="card" key={recipe.id}>
              <h2><Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link></h2>
              <p>{recipe.description}</p>
              <p className="muted">{recipe.servings} servings · {recipe.prep_minutes + recipe.cook_minutes} minutes</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
