import type { RecipeInput } from "../shared/types.ts";

export class InputError extends Error {}

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("A JSON object is required.");
  }
  return value as Record<string, unknown>;
}

export function text(body: Record<string, unknown>, key: string, max: number, required = true) {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
    throw new InputError(`${key.replaceAll("_", " ")} ${required ? "is required and" : ""} must be at most ${max} characters.`);
  }
  return value.trim();
}

export function emailInput(body: Record<string, unknown>) {
  const email = text(body, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InputError("Enter a valid email address.");
  }
  return email;
}

export function passwordInput(body: Record<string, unknown>) {
  const password = body.password;
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new InputError("Password must be between 12 and 128 characters.");
  }
  return password;
}

function integer(body: Record<string, unknown>, key: string, min: number, max: number) {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new InputError(`${key.replaceAll("_", " ")} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}

export function recipeInput(value: unknown): RecipeInput {
  const body = objectBody(value);
  return {
    title: text(body, "title", 160),
    description: text(body, "description", 2000, false),
    ingredients: text(body, "ingredients", 20000),
    instructions: text(body, "instructions", 30000),
    servings: integer(body, "servings", 1, 100),
    prep_minutes: integer(body, "prep_minutes", 0, 10080),
    cook_minutes: integer(body, "cook_minutes", 0, 10080),
  };
}
