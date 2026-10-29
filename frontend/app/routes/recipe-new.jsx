import { useNavigate } from "react-router";
import { SavedPopup } from "../components/saved-popup";
import { RecipeForm, saveRecipe } from "../components/recipe-form";
import { formError } from "../lib/api";
import "../styles/recipe-new.css";

export async function clientAction({ request }) {
  try {
    // Use the shared form helper to save a new recipe.
    const recipe = await saveRecipe(request);
    // The popup needs the saved flag and the ID of the recipe to open.
    return { saved: true, recipeId: recipe.id };
  } catch (error) {
    // Send save errors back to the form instead of showing the success popup.
    return formError(error);
  }
}

export default function NewRecipe({ actionData }) {
  const navigate = useNavigate();
  // Show the shared recipe form, then open the new recipe when the saved popup closes.
  // Replacing the history entry keeps Back from returning to the add form.
  return <section className="recipe-new-page"><h1 className="sr-only">Add a recipe</h1><RecipeForm error={actionData?.error} /><SavedPopup result={actionData} message="Your recipe has been saved!" onClose={() => navigate(`/recipes/${actionData.recipeId}`, { replace: true })} /></section>;
}
