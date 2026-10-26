import { Form, Link, useSearchParams } from "react-router";
import { useRef } from "react";
import { api } from "../lib/api";
import { filterGroups, filterRecipes } from "../lib/recipe-filters";
import { RecipeCard } from "../components/recipe-card";
import allIcon from "../images/category_all_icon.png";
import mushroomIcon from "../images/category_mushrooms_icon.png";
import berriesIcon from "../images/category_brries_icon.png";
import nutsIcon from "../images/category_nuts_icon.png";
import greensIcon from "../images/category_greens_icon.png";
import flowersIcon from "../images/category_flowers_icon.png";
import filterIcon from "../images/filter_icon.png";
import "../styles/recipes.css";

const categories = [
  ["", "All", allIcon], ["Mushroom", "Mushrooms", mushroomIcon],
  ["Berries & Fruit", "Berries & Fruit", berriesIcon], ["Nuts & Seeds", "Nuts & Seeds", nutsIcon],
  ["Wild Greens", "Wild Greens", greensIcon], ["Herbs & Flowers", "Herbs & Flowers", flowersIcon],
];

export async function clientLoader() {
  return { recipes: await api("/feed") };
}

export default function Recipes({ loaderData }) {
  const [params] = useSearchParams();
  const dialog = useRef(null);
  const results = filterRecipes(loaderData.recipes, params);
  const active = filterGroups.some(({ name }) => params.has(name));
  function categoryUrl(value) {
    const next = new URLSearchParams(params);
    next.delete("plant");
    if (value) next.set("plant", value);
    return `/recipes?${next}`;
  }
  return (
    <div className="recipes-page">
      <div className="feed-heading"><h1>Recipes</h1><Link to="/recipes/new" className="feed-add">Add new <span aria-hidden="true">＋</span></Link></div>
      <div className="feed-category-heading"><h2>Categories</h2><button aria-label="Filter recipes" onClick={() => dialog.current.showModal()}><img src={filterIcon} alt="" /></button></div>
      <nav className="feed-categories" aria-label="Recipe categories">
        {categories.map(([value, label, icon]) => {
          const selected = value ? params.getAll("plant").includes(value) : !params.has("plant");
          return <Link key={label} to={categoryUrl(value)} aria-current={selected ? "true" : undefined}><span className="feed-category-icon"><img src={icon} alt="" /></span><span>{label}</span></Link>;
        })}
      </nav>
      {active && <div className="feed-filter-summary"><span>{results.length} recipes match your filters</span><Link to="/recipes">Clear filters</Link></div>}
      {results.length ? <section className="recipe-feed" aria-label="Recipe feed">{results.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}</section> :
        <section className="feed-empty"><h2>{active ? "No matching recipes yet" : "The recipe feed starts here"}</h2><p>{active ? "Try different filters or clear your selection." : "Public recipes from the community will appear here. Add a recipe and choose Public to share it."}</p></section>}
      <dialog className="recipe-filter-dialog" ref={dialog} aria-labelledby="filter-title">
        <div className="filter-dialog-heading"><h2 id="filter-title">Filter</h2><button type="button" aria-label="Close filters" onClick={() => dialog.current.close()}>×</button></div>
        <Form method="get" action="/recipes" key={params.toString()} onSubmit={() => dialog.current.close()}>
          {filterGroups.map(({ name, label, options, single }) => (
            <fieldset key={name}><legend>{label}</legend><div className="filter-options">
              {options.map(([value, text]) => <label className="filter-chip" key={value}>
                <input type={single ? "radio" : "checkbox"} name={name} value={value} defaultChecked={single ? (params.get(name) ?? "newest") === value : params.getAll(name).includes(value)} />
                <span>{text}</span>
              </label>)}
            </div></fieldset>
          ))}
          <div className="filter-dialog-actions"><Link to="/recipes" onClick={() => dialog.current.close()}>Reset</Link><button type="submit">Apply</button></div>
        </Form>
      </dialog>
    </div>
  );
}
