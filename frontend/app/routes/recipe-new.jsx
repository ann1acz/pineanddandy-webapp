import { redirect } from "react-router";
import { RecipeForm, saveRecipe } from "../components/recipe-form";
import { formError } from "../lib/api";
import "../styles/recipe-new.css";

export async function clientAction({ request }) {
  try {
    const recipe = await saveRecipe(request);
    return redirect(`/recipes/${recipe.id}`);
  } catch (error) {
    return formError(error);
  }
}

export default function NewRecipe({ actionData }) {
  return <section className="recipe-new-page"><h1 className="sr-only">Add a recipe</h1><RecipeForm error={actionData?.error} /></section>;
}
