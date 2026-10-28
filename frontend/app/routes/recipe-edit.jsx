import { useNavigate } from "react-router";
import { SavedPopup } from "../components/saved-popup";
import { RecipeForm, saveRecipe } from "../components/recipe-form";
import { api, formError } from "../lib/api";
import "../styles/recipe-edit.css";

export async function clientLoader({ params }) {
  const recipe = await api(`/recipes/${params.recipeId}`);
  if (!recipe.is_owner) throw new Response("Only the author can edit this recipe.", { status: 403 });
  return { recipe };
}

export async function clientAction({ params, request }) {
  try {
    const recipe = await saveRecipe(request, params.recipeId);
    return { saved: true, recipeId: recipe.id };
  } catch (error) {
    return formError(error);
  }
}

export default function EditRecipe({ loaderData, actionData }) {
  const navigate = useNavigate();
  return <section className="recipe-edit-page"><h1 className="sr-only">Edit recipe</h1><RecipeForm key={loaderData.recipe.id} recipe={loaderData.recipe} error={actionData?.error} /><SavedPopup result={actionData} message="Your recipe has been saved!" onClose={() => navigate(`/recipes/${actionData.recipeId}`, { replace: true })} /></section>;
}
