import { redirect } from "react-router";
import { RecipeForm, saveRecipe } from "../components/recipe-form";
import { api, formError } from "../lib/api";

export async function clientLoader({ params }) {
  return { recipe: await api(`/recipes/${params.recipeId}`) };
}

export async function clientAction({ params, request }) {
  try {
    const recipe = await saveRecipe(request, params.recipeId);
    return redirect(`/recipes/${recipe.id}`);
  } catch (error) {
    return formError(error);
  }
}

export default function EditRecipe({ loaderData, actionData }) {
  return <section className="editor"><h1>Edit recipe</h1><RecipeForm key={loaderData.recipe.id} recipe={loaderData.recipe} error={actionData?.error} /></section>;
}
