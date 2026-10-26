import { index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home.jsx"),
  route("auth/:mode", "routes/auth.jsx"),
  layout("routes/account.jsx", [
    route("profile", "routes/profile.jsx"),
    route("recipes", "routes/recipes.jsx"),
    route("recipes/new", "routes/recipe-new.jsx"),
    route("recipes/:recipeId", "routes/recipe.jsx"),
    route("recipes/:recipeId/edit", "routes/recipe-edit.jsx"),
  ]),
];
