import { Form, Link, useNavigation } from "react-router";
import { useState } from "react";
import { api } from "../lib/api";
import { normalizeRecipeCategories, recipeCategoryOptions } from "../lib/recipe-filters";
import "../styles/recipe-form.css";

export async function saveRecipe(request, recipeId) {
  const form = await request.formData();
  return api(recipeId ? `/recipes/${recipeId}` : "/recipes", {
    method: recipeId ? "PUT" : "POST",
    body: JSON.stringify({
      title: form.get("title"),
      visibility: form.get("visibility"),
      description: form.get("description"),
      ingredients: form.get("ingredients"),
      instructions: form.get("instructions"),
      prep_minutes: Number(form.get("prep_minutes")),
      cook_minutes: Number(form.get("cook_minutes")),
      photos: form.getAll("photos"),
      plant_types: form.getAll("plant_types"),
      dish_types: form.getAll("dish_types"),
      seasons: form.getAll("seasons"),
      dietary_restrictions: form.getAll("dietary_restrictions"),
    }),
  });
}

export function RecipeForm({ recipe, error }) {
  const busy = useNavigation().state !== "idle";
  const [photos, setPhotos] = useState(recipe?.photos ?? []);
  const [photoError, setPhotoError] = useState("");
  const [reading, setReading] = useState(false);

  async function addPhotos(event) {
    const files = Array.from(event.target.files);
    event.target.value = "";
    setPhotoError("");
    if (photos.length + files.length > 3 ||
        files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1_048_576)) {
      setPhotoError("Choose up to 3 JPEG, PNG or WebP photos, at most 1 MB each.");
      return;
    }
    setReading(true);
    try {
      const images = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the photo. Please try again."));
        reader.onabort = () => reject(new Error("Photo upload was interrupted. Please try again."));
        reader.readAsDataURL(file);
      })));
      setPhotos((current) => [...current, ...images]);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      setPhotoError(error.message);
    } finally {
      setReading(false);
    }
  }

  return (
    <>
      <Form method="post" className="recipe-entry-form">
        <input type="hidden" name="description" value={recipe?.description ?? ""} />
        <input type="hidden" name="prep_minutes" value={recipe?.prep_minutes ?? 0} />
        <label>Name<input name="title" placeholder="Type here..." defaultValue={recipe?.title} maxLength={160} required /></label>
        <label>Visibility
          <select className="recipe-visibility" name="visibility" defaultValue={recipe?.visibility ?? "private"}>
            <option value="private">Private - only me, on my profile</option>
            <option value="public">Public - share in the recipe feed</option>
          </select>
        </label>
        <fieldset className="recipe-photos">
          <legend>Photos</legend>
          <div className="recipe-photo-list">
            {photos.map((photo, index) => (
              <div className="recipe-photo" key={index}>
                <input type="hidden" name="photos" value={photo} />
                <img src={photo} alt={`Recipe photo ${index + 1}`} />
                <button type="button" aria-label={`Remove photo ${index + 1}`} disabled={reading || busy} onClick={() => setPhotos(photos.filter((_, i) => i !== index))}>×</button>
              </div>
            ))}
            {photos.length < 3 && <label className={`recipe-photo-add${reading || busy ? " is-disabled" : ""}`}>
              <span aria-hidden="true">+</span>
              <span className="sr-only">Add photos</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} disabled={reading || busy} aria-describedby="recipe-photo-help" />
            </label>}
          </div>
          <p id="recipe-photo-help" className="recipe-photo-help">Up to 3 photos, 1 MB each. JPEG, PNG or WebP.</p>
          {reading && <p role="status">Reading photos...</p>}
          {photoError && <p className="error" role="alert">{photoError}</p>}
        </fieldset>
        <label>Ingredients<textarea name="ingredients" defaultValue={recipe?.ingredients} placeholder="One ingredient per line..." maxLength={20000} rows={5} required /></label>
        <label>Instructions<textarea name="instructions" defaultValue={recipe?.instructions} placeholder="One step per line..." maxLength={30000} rows={5} required /></label>
        <label>Cooking time
          <span className="recipe-time"><input type="number" name="cook_minutes" placeholder="Type a number..." defaultValue={recipe?.cook_minutes} min={0} max={10080} required /><span>minutes</span></span>
        </label>
        <CategoryField label="Plant type" name="plant_types" initial={normalizeRecipeCategories(recipe?.plant_types, "plant")} options={recipeCategoryOptions("plant")} />
        <CategoryField label="Dish type" name="dish_types" initial={normalizeRecipeCategories(recipe?.dish_types, "dish")} options={recipeCategoryOptions("dish")} />
        <CategoryField label="Season" name="seasons" initial={recipe?.seasons} options={recipeCategoryOptions("season")} />
        <CategoryField label="Dietary restrictions" name="dietary_restrictions" initial={recipe?.dietary_restrictions} options={recipeCategoryOptions("diet")} />
        {error && <p className="error" role="alert">{error}</p>}
        <div className="recipe-form-actions">
          <Link to={recipe ? `/recipes/${recipe.id}` : "/recipes"}>Cancel</Link>
          <button disabled={busy || reading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 3h12l4 4v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></svg>
            {busy ? "Saving..." : "Save recipe"}
          </button>
        </div>
      </Form>
    </>
  );
}

function CategoryField({ label, name, initial = [], options }) {
  const [selected, setSelected] = useState(initial);
  return (
    <fieldset className="recipe-category">
      <legend>{label}</legend>
      <div className="recipe-category-control">
        {selected.map((value) => (
          <span className="recipe-category-chip" key={value}>
            <input type="hidden" name={name} value={value} />
            {value}<button type="button" aria-label={`Remove ${value} from ${label}`} onClick={() => setSelected(selected.filter((item) => item !== value))}>×</button>
          </span>
        ))}
        {selected.length < 12 && <select aria-label={label} value="" onChange={(event) => { if (event.target.value) setSelected([...selected, event.target.value]); }}>
          <option value="" disabled>{selected.length ? "Add another..." : "Select one from each category"}</option>
          {options.filter((value) => !selected.includes(value)).map((value) => <option key={value}>{value}</option>)}
        </select>}
      </div>
    </fieldset>
  );
}
