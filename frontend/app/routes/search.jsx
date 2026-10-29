import { Form, Link, useNavigation } from "react-router";
import { useState } from "react";
import { api } from "../lib/api";
import searchIcon from "../images/orange_search_icon.png";
import filterIcon from "../images/filter_icon.png";
import "../styles/search.css";

export async function clientLoader({ request }) {
  // Read and tidy the search options from the URL.
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 160);
  const season = params.get("season") ?? "";
  const diet = params.get("diet") ?? "";
  const profile = await api("/profile");
  // Only fetch recipes when there is a search word or a filter to use.
  const recipes = query || season || diet ? await api("/feed") : [];
  // Keep each user's recent searches separate in this browser.
  const key = `pineanddandy:search-history:${profile.id}`;
  let history = [];
  let warning = "";
  try {
    // Load recent searches and keep the latest searches at the top.
    const stored = JSON.parse(localStorage.getItem(key) ?? "[]");
    // Check the stored values before using them as search links.
    if (!Array.isArray(stored) || stored.some((item) => typeof item !== "string" || item.length > 160)) {
      throw new SyntaxError("Invalid search history.");
    }
    history = stored.slice(0, 10);
    if (query) {
      // Move repeated searches to the top and keep only the latest ten.
      history = [query, ...history.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(history));
    }
  } catch (error) {
    // Searching still works if browser storage is blocked or contains bad data.
    if (!(error instanceof SyntaxError) && !(error instanceof DOMException)) throw error;
    warning = "Recent searches could not be saved or loaded in this browser.";
  }
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  // Keep recipes that match every search word and selected filter.
  const results = recipes.filter((recipe) => {
    const text = [recipe.title, recipe.description, recipe.ingredients, recipe.instructions,
      ...(recipe.plant_types ?? []), ...(recipe.dish_types ?? [])].join(" ").toLowerCase();
    return words.every((word) => text.includes(word)) &&
      (!season || recipe.seasons?.includes(season)) &&
      (!diet || recipe.dietary_restrictions?.includes(diet));
  });
  return { query, season, diet, history, warning, results, searched: Boolean(query || season || diet) };
}

export default function Search({ loaderData }) {
  const { query, season, diet, history, warning, results, searched } = loaderData;
  // Start with the filter panel open if the URL already contains filters.
  const [filtersOpen, setFiltersOpen] = useState(Boolean(season || diet));
  const busy = useNavigation().state !== "idle";
  return (
    <section className="search-page" aria-labelledby="search-heading" aria-busy={busy}>
      <h1 className="sr-only" id="search-heading">Search recipes</h1>
      <Link className="search-back" to="/recipes" aria-label="Back to recipes">←</Link>
      {/* Reset the form values when the search in the URL changes. */}
      <Form method="get" action="/search" className="search-form" key={`${query}:${season}:${diet}`}>
        <div className="search-row">
          <div className="search-input">
            <button type="submit" aria-label="Search recipes" disabled={busy}><img src={searchIcon} alt="" /></button>
            <input type="search" name="q" aria-label="Search recipes" placeholder="Any ideas?" defaultValue={query} maxLength={160} autoFocus />
          </div>
          <button className="search-filter-toggle" type="button" aria-label="Search filters" aria-expanded={filtersOpen} aria-controls="search-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
            <img src={filterIcon} alt="" />
          </button>
        </div>
        <fieldset id="search-filters" className="search-filters" hidden={!filtersOpen}>
          <legend>Filter recipes</legend>
          <label>Season<select name="season" defaultValue={season}><option value="">All seasons</option>{["Spring", "Summer", "Autumn", "Winter"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Dietary restrictions<select name="diet" defaultValue={diet}><option value="">All diets</option>{["Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Nut-free", "Egg-free"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <button type="submit" disabled={busy}>Apply filters</button>
        </fieldset>
      </Form>
      {warning && <p className="search-warning" role="alert">{warning}</p>}
      {/* Show recent searches until a search word or filter has been submitted. */}
      {searched ? <section aria-live="polite">
        <h2 className="search-section-heading">Search results</h2>
        <p className="search-result-count">{busy ? "Searching..." : `${results.length} ${results.length === 1 ? "recipe" : "recipes"} found`}</p>
        {results.length ? <ul className="search-results">{results.map((recipe) => (
          <li key={recipe.id}><Link to={`/recipes/${recipe.id}`}><strong>{recipe.title}</strong><span>{recipe.description || `${recipe.cook_minutes} minutes cooking time`}</span></Link></li>
        ))}</ul> : <p>No recipes match. Try another search or change the filters.</p>}
      </section> : <section>
        <h2 className="search-section-heading">Recent searches</h2>
        {history.length ? <ul className="search-history">{history.map((term) => (
          <li key={term}><Link to={`/search?${new URLSearchParams({ q: term })}`}><span>{term}</span><span aria-hidden="true">→</span></Link></li>
        ))}</ul> : <p className="search-empty">Your recent searches will appear here.</p>}
      </section>}
    </section>
  );
}
