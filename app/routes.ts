import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/:mode", "routes/auth.tsx"),
  layout("routes/account.tsx", [
    route("profile", "routes/profile.tsx"),
    route("recipes", "routes/recipes.tsx"),
    route("recipes/new", "routes/recipe-new.tsx"),
    route("recipes/:recipeId", "routes/recipe.tsx"),
    route("recipes/:recipeId/edit", "routes/recipe-edit.tsx"),
  ]),
] satisfies RouteConfig;
