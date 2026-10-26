import { Form, Link, redirect, useNavigation } from "react-router";
import { api, formError } from "../lib/api";

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
  return (
    <article className="editor">
      <Link to="/recipes">Back to recipes</Link>
      <h1>{recipe.title}</h1>
      <p className="preserve-lines">{recipe.description}</p>
      <p className="muted">{recipe.servings} servings · Prep {recipe.prep_minutes} min · Cook {recipe.cook_minutes} min</p>
      <div className="actions">
        <Link className="button secondary" to={`/recipes/${recipe.id}/edit`}>Edit recipe</Link>
        <Form method="post" onSubmit={(event) => {
          if (!window.confirm("Permanently delete this recipe?")) event.preventDefault();
        }}>
          <button className="danger" disabled={busy}>{busy ? "Deleting..." : "Delete recipe"}</button>
        </Form>
      </div>
      {actionData?.error && <p className="error" role="alert">{actionData.error}</p>}
      <section className="card"><h2>Ingredients</h2><p className="preserve-lines">{recipe.ingredients}</p></section>
      <section className="card"><h2>Instructions</h2><p className="preserve-lines">{recipe.instructions}</p></section>
    </article>
  );
}
