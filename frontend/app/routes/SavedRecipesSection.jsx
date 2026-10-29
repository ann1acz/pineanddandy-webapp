import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useFetcher } from "react-router";
import { filterGroups, filterRecipes } from "../lib/recipe-filters";
import { RecipeCard } from "../components/recipe-card";
import searchIcon from "../images/search_icon.png";
import filterIcon from "../images/filter_icon.png";

const TABS = ["All", "Guides", "Recipes"];

function SavedGuideCard({ guide }) {
  const fetcher = useFetcher();
  return (
    <article className="saved-guide-card">
      <a href={guide.url} target="_blank" rel="noopener noreferrer">{guide.title}</a>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="delete-guide" />
        <input type="hidden" name="id" value={guide.id} />
        <button type="submit" disabled={fetcher.state !== "idle"} aria-label={`Remove ${guide.title} from saved guides`}>×</button>
      </fetcher.Form>
    </article>
  );
}

export function SavedRecipesSection({ savedRecipes, savedGuides }) {
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(new URLSearchParams());
  const [guideFormOpen, setGuideFormOpen] = useState(false);
  const dialog = useRef(null);
  const guideFetcher = useFetcher();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const guides = tab === "Recipes" ? [] : savedGuides.filter((guide) =>
    `${guide.title} ${guide.url}`.toLocaleLowerCase().includes(normalizedQuery));
  const recipes = tab === "Guides" ? [] : filterRecipes(savedRecipes, filters).filter((recipe) =>
    [recipe.title, recipe.description, ...(recipe.plant_types ?? []), ...(recipe.dish_types ?? []), ...(recipe.seasons ?? [])]
      .join(" ").toLocaleLowerCase().includes(normalizedQuery));

  useEffect(() => {
    if (guideFetcher.data?.guide) setGuideFormOpen(false);
  }, [guideFetcher.data]);

  return (
    <section className="saved-guides-section" aria-labelledby="saved-guides-title">
      <h2 id="saved-guides-title">Saved for another day</h2>
      <p className="saved-guides-subtitle">Your guides &amp; recipes · {savedRecipes.length + savedGuides.length} Saved</p>

      <div className="saved-guides-search-row">
        <label className="saved-guides-search">
          <img src={searchIcon} alt="" />
          <span className="sr-only">Search saved recipes and guides</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved items" />
        </label>
        <button className="saved-guides-filter-button" type="button" onClick={() => dialog.current.showModal()} aria-label="Filter saved recipes">
          <img src={filterIcon} alt="" />
        </button>
      </div>

      <div className="saved-guides-tabs" role="tablist" aria-label="Saved item type">
        {TABS.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>

      {tab !== "Recipes" && (
        <div className="saved-guides-guide-actions">
          <button type="button" onClick={() => setGuideFormOpen((open) => !open)}>
            {guideFormOpen ? "Cancel" : "＋ Save a guide"}
          </button>
        </div>
      )}

      {guideFormOpen && (
        <guideFetcher.Form method="post" className="saved-guide-form">
          <input type="hidden" name="intent" value="save-guide" />
          <label>Guide title<input name="title" maxLength={160} required placeholder="e.g. A guide to woodland mushrooms" /></label>
          <label>Guide link<input name="url" type="url" maxLength={2048} required placeholder="https://..." /></label>
          {guideFetcher.data?.error && <p className="saved-guide-error" role="alert">{guideFetcher.data.error}</p>}
          <button type="submit" disabled={guideFetcher.state !== "idle"}>
            {guideFetcher.state !== "idle" ? "Saving..." : "Save guide"}
          </button>
        </guideFetcher.Form>
      )}

      {guides.length > 0 || recipes.length > 0 ? (
        <div className="saved-guides-results">
          {guides.map((guide) => <SavedGuideCard key={guide.id} guide={guide} />)}
          {recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
        </div>
      ) : (
        <div className="saved-guides-empty">
          <svg viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M5 3.75h22a2 2 0 0 1 2 2v31L16 29.5 3 36.75v-31a2 2 0 0 1 2-2Z" />
          </svg>
          <p>{query || filters.size ? "No saved items match your search." : tab === "Guides" ? "Saved guides will appear here." : "Saves will appear here."}</p>
          {!query && !filters.size && tab !== "Guides" && <Link to="/recipes" className="saved-guides-explore">Explore Recipes</Link>}
        </div>
      )}

      <dialog className="saved-guides-filter-dialog" ref={dialog} aria-labelledby="saved-filter-title">
        <div className="saved-filter-heading">
          <h3 id="saved-filter-title">Filter saved recipes</h3>
          <button type="button" aria-label="Close filters" onClick={() => dialog.current.close()}>×</button>
        </div>
        <form key={filters.toString()} onSubmit={(event) => {
          event.preventDefault();
          setFilters(new URLSearchParams(new FormData(event.currentTarget)));
          dialog.current.close();
        }}>
          {filterGroups.filter(({ name }) => name !== "sort" && name !== "time").map(({ name, label, options }) => (
            <fieldset key={name}>
              <legend>{label}</legend>
              <div className="saved-filter-options">
                {options.map(([value, text]) => (
                  <label key={value} className="saved-filter-chip">
                    <input type="checkbox" name={name} value={value} defaultChecked={filters.getAll(name).includes(value)} />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="saved-filter-actions">
            <button type="button" className="saved-filter-reset" onClick={() => {
              setFilters(new URLSearchParams());
              dialog.current.querySelector("form").reset();
            }}>Reset</button>
            <button type="submit">Apply filters</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}