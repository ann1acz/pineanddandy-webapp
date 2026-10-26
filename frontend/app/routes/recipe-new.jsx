import { redirect } from "react-router";
import { RecipeForm, saveRecipe } from "../components/recipe-form";
import { formError } from "../lib/api";

export async function clientAction({ request }) {
  try {
    const recipe = await saveRecipe(request);
    return redirect(`/recipes/${recipe.id}`);
  } catch (error) {
    return formError(error);
  }
}

export default function NewRecipe({ actionData }) {
  return <section className="editor"><h1>Add a recipe</h1><RecipeForm error={actionData?.error} /></section>;
}
