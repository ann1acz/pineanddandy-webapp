export function recipeLines(text) {
  return text.split(/\r\n|\n|\r/).map((line) =>
    line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, "").trim(),
  ).filter(Boolean);
}
