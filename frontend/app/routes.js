import { index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home.jsx"),
  route("login", "routes/login.jsx"),
  route("signup", "routes/signup.jsx"),
  layout("routes/account.jsx", [
    route("search", "routes/search.jsx"),
    route("profile", "routes/profile.jsx"),
    route("recipes", "routes/recipes.jsx"),
    route("recipes/new", "routes/recipe-new.jsx"),
    route("recipes/:recipeId", "routes/recipe.jsx"),
    route("recipes/:recipeId/edit", "routes/recipe-edit.jsx"),
    route("recipes/:recipeId/bookmark", "routes/recipe-bookmark.jsx"),
  ]),
  route("*", "routes/fourohfour.jsx"),
];
