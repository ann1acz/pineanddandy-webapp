import { redirect } from "react-router";
import type { Route } from "./+types/recipe-new";
import { RecipeForm, saveRecipe } from "../components/recipe-form";
import { formError } from "../lib/api";

export async function clientAction({ request }: Route.ClientActionArgs) {
  try {
    const recipe = await saveRecipe(request);
    return redirect(`/recipes/${recipe.id}`);
  } catch (error) {
    return formError(error);
  }
}

export default function NewRecipe({ actionData }: Route.ComponentProps) {
  return <section className="editor"><h1>Add a recipe</h1><RecipeForm error={actionData?.error} /></section>;
}
