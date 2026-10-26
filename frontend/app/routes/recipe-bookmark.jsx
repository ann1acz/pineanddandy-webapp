import { api, formError } from "../lib/api";

export async function clientAction({ request, params }) {
  const form = await request.formData();
  try {
    await api(`/recipes/${params.recipeId}/bookmark`, { method: form.get("saved") === "true" ? "DELETE" : "PUT" });
    return { error: null };
  } catch (error) {
    return formError(error);
  }
}
