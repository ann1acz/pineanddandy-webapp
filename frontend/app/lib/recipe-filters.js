export const plantGroups = {
  Mushroom: ["Mushroom"],
  "Berries & Fruit": ["Berry", "Fruit"],
  "Nuts & Seeds": ["Nut", "Seed"],
  "Wild Greens": ["Leafy green", "Root", "Seaweed"],
  "Herbs & Flowers": ["Herb", "Flower"],
};

export const filterGroups = [
  { name: "sort", label: "Sort by", options: [["newest", "Newest"], ["popular", "Most bookmarked"], ["quickest", "Quickest"]], single: true },
  { name: "plant", label: "Plant type", options: Object.keys(plantGroups).map((value) => [value, value]) },
  { name: "time", label: "Cooking time", options: [["under15", "Under 15 min"], ["15to30", "15 to 30 min"], ["30to60", "30 to 60 min"], ["over60", "Over 1 hour"]] },
  { name: "season", label: "Season", options: ["Spring", "Summer", "Autumn", "Winter"].map((value) => [value, value]) },
  { name: "dish", label: "Dish type", options: ["Meals", "Desserts", "Pantry", "Drinks", "Snacks", "Syrups"].map((value) => [value, value]) },
  { name: "diet", label: "Dietary restrictions", options: ["Vegetarian", "Vegan", "Nut-free", "Gluten-free", "Dairy-free", "Egg-free"].map((value) => [value, value]) },
];

const dishes = { Meals: ["Breakfast", "Main", "Side", "Soup", "Salad", "Meals"], Desserts: ["Dessert"], Pantry: ["Preserve", "Pantry"], Drinks: ["Drink"], Snacks: ["Snack"], Syrups: ["Syrup"] };

export function recipeCategoryOptions(name) {
  return filterGroups.find((group) => group.name === name).options.map(([value]) => value);
}

export function normalizeRecipeCategories(values = [], name) {
  const mapping = name === "plant" ? plantGroups : name === "dish" ? dishes : {};
  return [...new Set(values.map((value) =>
    Object.keys(mapping).find((category) => mapping[category].includes(value)) ?? value))];
}
const times = {
  under15: (minutes) => minutes < 15,
  "15to30": (minutes) => minutes >= 15 && minutes < 30,
  "30to60": (minutes) => minutes >= 30 && minutes <= 60,
  over60: (minutes) => minutes > 60,
};

export function filterRecipes(recipes, params) {
  const selections = Object.fromEntries(filterGroups.map(({ name, options }) => [
    name, params.getAll(name).filter((value) => options.some(([option]) => option === value)),
  ]));
  const matches = (values, selected, mapping) => !selected.length ||
    selected.some((value) => [value, ...(mapping?.[value] ?? [])].some((item) => values?.includes(item)));
  const filtered = recipes.filter((recipe) =>
    matches(recipe.plant_types, selections.plant, plantGroups) &&
    matches(recipe.dish_types, selections.dish, dishes) &&
    matches(recipe.seasons, selections.season) &&
    matches(recipe.dietary_restrictions, selections.diet) &&
    (!selections.time.length || selections.time.some((value) => times[value](recipe.cook_minutes))));
  const sort = selections.sort[0] ?? "newest";
  return filtered.sort((a, b) => {
    if (sort === "popular" && a.bookmark_count !== b.bookmark_count) return b.bookmark_count - a.bookmark_count;
    if (sort === "quickest" && a.cook_minutes !== b.cook_minutes) return a.cook_minutes - b.cook_minutes;
    return new Date(b.created_at) - new Date(a.created_at) || a.id.localeCompare(b.id);
  });
}
