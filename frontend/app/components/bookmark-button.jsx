import { useFetcher } from "react-router";
import "../styles/recipe-bookmark.css";

export function BookmarkButton({ recipe }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  return (
    <div className="bookmark-control">
      <fetcher.Form method="post" action={`/recipes/${recipe.id}/bookmark`}>
        <input type="hidden" name="saved" value={String(recipe.bookmarked)} />
        <button className="bookmark-button" aria-label={`${recipe.bookmarked ? "Remove bookmark for" : "Bookmark"} ${recipe.title}`} aria-pressed={recipe.bookmarked} disabled={busy}>
          <svg viewBox="0 0 24 24" fill={recipe.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 3h14v19l-7-5-7 5Z" /></svg>
        </button>
      </fetcher.Form>
      {fetcher.data?.error && <p className="error" role="alert">{fetcher.data.error}</p>}
    </div>
  );
}
