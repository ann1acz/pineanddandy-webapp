import { api, formError } from "../lib/api";

export async function clientAction({ request, params }) {
  // The button sends its current saved state so we know which way to toggle it.
  const form = await request.formData();
  try {
    // Remove the bookmark if it is already saved, otherwise add it.
    await api(`/recipes/${params.recipeId}/bookmark`, { method: form.get("saved") === "true" ? "DELETE" : "PUT" });
    return { error: null };
  } catch (error) {
    // Return the error so the bookmark button can show it.
    return formError(error);
  }
}
