export class InputError extends Error {}

export function objectBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("A JSON object is required.");
  }
  return value;
}

export function text(body, key, max, required = true) {
  const value = body[key];
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) {
    throw new InputError(`${key.replaceAll("_", " ")} ${required ? "is required and" : ""} must be at most ${max} characters.`);
  }
  return value.trim();
}

export function emailInput(body) {
  const email = text(body, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InputError("Enter a valid email address.");
  }
  return email;
}

export function passwordInput(body) {
  const password = body.password;
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new InputError("Password must be between 12 and 128 characters.");
  }

  return password;
}

export function usernameInput(body) {
  const username = text(body, "username", 40).toLowerCase();
  if (!/^[a-z0-9_]{3,40}$/.test(username)) {
    throw new InputError("Username must be 3-40 characters using letters, numbers or underscores.");
  }
  return username;
}

function integer(body, key, min, max) {
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new InputError(`${key.replaceAll("_", " ")} must be a whole number between ${min} and ${max}.`);
  }
  return value;
}

export function recipeInput(value) {
  const body = objectBody(value);
  if (body.visibility !== undefined && !["private", "public"].includes(body.visibility)) {
    throw new InputError("Choose private or public recipe visibility.");
  }
  return {
    visibility: body.visibility ?? "private",
    title: text(body, "title", 160),
    description: text(body, "description", 2000, false),
    ingredients: text(body, "ingredients", 20000),
    instructions: text(body, "instructions", 30000),
    prep_minutes: integer(body, "prep_minutes", 0, 10080),
    cook_minutes: integer(body, "cook_minutes", 0, 10080),
    photos: photosInput(body.photos),
    plant_types: categories(body, "plant_types"),
    dish_types: categories(body, "dish_types"),
    seasons: categories(body, "seasons"),
    dietary_restrictions: categories(body, "dietary_restrictions"),
  };
}

function categories(body, key) {
  const values = body[key] ?? [];
  if (!Array.isArray(values) || values.length > 12 ||
      values.some((value) => typeof value !== "string" || !value.trim() || value.length > 60)) {
    throw new InputError(`${key.replaceAll("_", " ")} must contain at most 12 labels of 1-60 characters.`);
  }
  return [...new Set(values.map((value) => value.trim()))];
}

function photosInput(value = []) {
  if (!Array.isArray(value) || value.length > 3) {
    throw new InputError("Upload at most 3 photos.");
  }

  return value.map((photo) => {
    if (typeof photo !== "string" || photo.length > 1_398_130) {
      throw new InputError("Each photo must be a JPEG, PNG or WebP image of at most 1 MB.");
    }
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
    if (!match) throw new InputError("Photos must be JPEG, PNG or WebP images.");
    const bytes = Buffer.from(match[2], "base64");
    const valid = match[1] === "jpeg" ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) :
      match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
        bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid || bytes.length > 1_048_576 || bytes.toString("base64") !== match[2]) {
      throw new InputError("Each photo must be a valid JPEG, PNG or WebP image of at most 1 MB.");
    }
    return photo;
  });
}

export function profilePhotoInput(value) {
  if (value === "") return "";
  return photosInput([value])[0];
}
