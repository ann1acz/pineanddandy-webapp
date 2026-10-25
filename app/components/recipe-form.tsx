import { Form, Link, useNavigation } from "react-router";
import type { Recipe } from "../../shared/types";
import { api } from "../lib/api";

export async function saveRecipe(request: Request, recipeId?: string) {
  const form = await request.formData();
  return api<Recipe>(recipeId ? `/recipes/${recipeId}` : "/recipes", {
    method: recipeId ? "PUT" : "POST",
    body: JSON.stringify({
      ...Object.fromEntries(form),
      servings: Number(form.get("servings")),
      prep_minutes: Number(form.get("prep_minutes")),
      cook_minutes: Number(form.get("cook_minutes")),
    }),
  });
}

export function RecipeForm({ recipe, error }: { recipe?: Recipe; error?: string }) {
  const busy = useNavigation().state !== "idle";
  return (
    <Form method="post" className="stack">
      <label>Recipe title<input name="title" defaultValue={recipe?.title} maxLength={160} required /></label>
      <label>Description<textarea name="description" defaultValue={recipe?.description} maxLength={2000} rows={3} /></label>
      <div className="form-row">
        <label>Servings<input type="number" name="servings" defaultValue={recipe?.servings ?? 2} min={1} max={100} required /></label>
        <label>Prep (minutes)<input type="number" name="prep_minutes" defaultValue={recipe?.prep_minutes ?? 0} min={0} max={10080} required /></label>
        <label>Cook (minutes)<input type="number" name="cook_minutes" defaultValue={recipe?.cook_minutes ?? 0} min={0} max={10080} required /></label>
      </div>
      <label>Ingredients<textarea name="ingredients" defaultValue={recipe?.ingredients} placeholder="One ingredient per line, including quantities" maxLength={20000} rows={7} required /></label>
      <label>Instructions<textarea name="instructions" defaultValue={recipe?.instructions} placeholder="Describe each step" maxLength={30000} rows={9} required /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button disabled={busy}>{busy ? "Saving..." : "Save recipe"}</button>
        <Link to={recipe ? `/recipes/${recipe.id}` : "/recipes"}>Cancel</Link>
      </div>
    </Form>
  );
}
