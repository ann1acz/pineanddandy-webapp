import assert from "node:assert/strict";
import { test } from "node:test";
import { recipeLines } from "./recipe-lines.js";

test("recipe lists split newline variants and omit blank lines", () => {
  assert.deepEqual(recipeLines(" First \r\n\r\n Second\nThird\rFourth "), ["First", "Second", "Third", "Fourth"]);
  assert.deepEqual(recipeLines(" \n "), []);
});

test("existing bullets and numbering do not produce duplicate list markers", () => {
  assert.deepEqual(recipeLines("- Berries\n* Sugar\n• Lemon\n1. Wash\n2) Cook"), ["Berries", "Sugar", "Lemon", "Wash", "Cook"]);
});

test("ingredient quantities and ordinary punctuation are preserved", () => {
  assert.deepEqual(recipeLines("300g berries\n1.5 cups sugar\n1/2 lemon\n2 tablespoons juice\n-5 degrees"), ["300g berries", "1.5 cups sugar", "1/2 lemon", "2 tablespoons juice", "-5 degrees"]);
});
