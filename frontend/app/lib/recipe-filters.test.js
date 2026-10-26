import assert from "node:assert/strict";
import { test } from "node:test";
import { filterRecipes, normalizeRecipeCategories, recipeCategoryOptions } from "./recipe-filters.js";

const recipes = [
  { id: "a", created_at: "2026-10-20", cook_minutes: 14, bookmark_count: 2, plant_types: ["Mushroom"], dish_types: ["Soup"], seasons: ["Autumn"], dietary_restrictions: ["Vegan"] },
  { id: "b", created_at: "2026-10-22", cook_minutes: 15, bookmark_count: 5, plant_types: ["Berry"], dish_types: ["Dessert"], seasons: ["Summer"], dietary_restrictions: ["Gluten-free"] },
  { id: "c", created_at: "2026-10-21", cook_minutes: 30, bookmark_count: 1, plant_types: ["Herb"], dish_types: ["Main"], seasons: ["Autumn"], dietary_restrictions: ["Vegan"] },
  { id: "d", created_at: "2026-10-19", cook_minutes: 60, bookmark_count: 0, plant_types: ["Seed"], dish_types: ["Preserve"], seasons: ["Winter"], dietary_restrictions: [] },
  { id: "e", created_at: "2026-10-18", cook_minutes: 61, bookmark_count: 0, plant_types: ["Leafy green"], dish_types: ["Syrup"], seasons: ["Spring"], dietary_restrictions: [] },
];
const ids = (query) => filterRecipes(recipes, new URLSearchParams(query)).map((recipe) => recipe.id);

test("form category options match filters and legacy selections normalize without duplicates", () => {
  assert.deepEqual(recipeCategoryOptions("plant"), ["Mushroom", "Berries & Fruit", "Nuts & Seeds", "Wild Greens", "Herbs & Flowers"]);
  assert.deepEqual(recipeCategoryOptions("dish"), ["Meals", "Desserts", "Pantry", "Drinks", "Snacks", "Syrups"]);
  assert.deepEqual(normalizeRecipeCategories(["Berry", "Fruit", "Herb"], "plant"), ["Berries & Fruit", "Herbs & Flowers"]);
  assert.deepEqual(normalizeRecipeCategories(["Soup", "Main", "Dessert"], "dish"), ["Meals", "Desserts"]);
  for (const name of ["plant", "dish"]) {
    for (const category of recipeCategoryOptions(name)) {
      const recipe = { ...recipes[0], plant_types: [], dish_types: [], [name === "plant" ? "plant_types" : "dish_types"]: [category] };
      assert.equal(filterRecipes([recipe], new URLSearchParams({ [name]: category })).length, 1);
      assert.deepEqual(normalizeRecipeCategories([category], name), [category]);
    }
  }
});

test("feed sorting uses newest, bookmark popularity and cooking duration without mutating input", () => {
  assert.deepEqual(ids(""), ["b", "c", "a", "d", "e"]);
  assert.deepEqual(ids("sort=popular"), ["b", "a", "c", "d", "e"]);
  assert.deepEqual(ids("sort=quickest"), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(recipes.map((recipe) => recipe.id), ["a", "b", "c", "d", "e"]);
});

test("plant categories map to recipe field values", () => {
  for (const [plant, expected] of [["Mushroom", "a"], ["Berries & Fruit", "b"], ["Herbs & Flowers", "c"], ["Nuts & Seeds", "d"], ["Wild Greens", "e"]]) {
    assert.deepEqual(ids(new URLSearchParams({ plant })), [expected]);
  }
});

test("time filters have exact non-overlapping boundaries", () => {
  assert.deepEqual(ids("time=under15"), ["a"]);
  assert.deepEqual(ids("time=15to30"), ["b"]);
  assert.deepEqual(ids("time=30to60"), ["c", "d"]);
  assert.deepEqual(ids("time=over60"), ["e"]);
});

test("filters combine groups with AND and alternatives within groups with OR", () => {
  assert.deepEqual(ids("plant=Mushroom&plant=Herbs+%26+Flowers&season=Autumn&diet=Vegan&dish=Meals"), ["c", "a"]);
  assert.deepEqual(ids("season=Summer&diet=Vegan"), []);
  assert.deepEqual(ids("dish=Pantry"), ["d"]);
  assert.deepEqual(ids("dish=Syrups"), ["e"]);
  assert.deepEqual(ids("dish=Desserts"), ["b"]);
});

test("unknown URL filters do not cause crashes or silently exclude every recipe", () => {
  assert.deepEqual(ids("sort=unknown&time=unknown&plant=unknown"), ids(""));
  assert.deepEqual(filterRecipes([], new URLSearchParams()), []);
});
