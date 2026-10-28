import { useNavigate } from "react-router";
import { SavedPopup } from "../components/saved-popup";
import { RecipeForm, saveRecipe } from "../components/recipe-form";
import { formError } from "../lib/api";
import "../styles/recipe-new.css";

export async function clientAction({ request }) {
  try {
    const recipe = await saveRecipe(request);
    return { saved: true, recipeId: recipe.id };
  } catch (error) {
    return formError(error);
  }
}

export default function NewRecipe({ actionData }) {
  const navigate = useNavigate();
  return <section className="recipe-new-page"><h1 className="sr-only">Add a recipe</h1><RecipeForm error={actionData?.error} /><SavedPopup result={actionData} message="Your recipe has been saved!" onClose={() => navigate(`/recipes/${actionData.recipeId}`, { replace: true })} /></section>;
}
