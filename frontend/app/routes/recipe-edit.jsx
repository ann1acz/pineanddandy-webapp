import { useNavigate } from "react-router";
import { SavedPopup } from "../components/saved-popup";
import { RecipeForm, saveRecipe } from "../components/recipe-form";
import { api, formError } from "../lib/api";
import "../styles/recipe-edit.css";

export async function clientLoader({ params }) {
  // Use the recipe ID from the URL to load the existing form values.
  const recipe = await api(`/recipes/${params.recipeId}`);
  // Only let the recipe owner make changes.
  if (!recipe.is_owner) throw new Response("Only the author can edit this recipe.", { status: 403 });
  return { recipe };
}

export async function clientAction({ params, request }) {
  try {
    // Save the changes to the recipe that is being edited.
    const recipe = await saveRecipe(request, params.recipeId);
    return { saved: true, recipeId: recipe.id };
  } catch (error) {
    // Keep save errors on the form so the user can correct them.
    return formError(error);
  }
}

export default function EditRecipe({ loaderData, actionData }) {
  const navigate = useNavigate();
  // Fill the shared form with this recipe and open its page when the saved popup closes.
  // Replacing the history entry keeps Back from returning to this edit form.
  return <section className="recipe-edit-page"><h1 className="sr-only">Edit recipe</h1><RecipeForm key={loaderData.recipe.id} recipe={loaderData.recipe} error={actionData?.error} /><SavedPopup result={actionData} message="Your recipe has been saved!" onClose={() => navigate(`/recipes/${actionData.recipeId}`, { replace: true })} /></section>;
}
