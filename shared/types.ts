export interface Profile {
  id: string;
  email: string;
  display_name: string;
  bio: string;
}

export interface RecipeInput {
  title: string;
  description: string;
  ingredients: string;
  instructions: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
}

export interface Recipe extends RecipeInput {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}
