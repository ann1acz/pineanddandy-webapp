import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { api } from "../lib/api";
import { RecipeCard } from "../components/recipe-card";
import "../styles/recipe-card.css";
import "../styles/home.css";

import heroImage from "../images/Heroimage-homepage.png";
import greetingBubbleImage from "../images/Homepage-(Hi Forager).png";
import allRecipesButtonImage from "../images/Allrecipe-buttonhome.png";
import brushStroke from "../images/Backgroundhome-stroke.png";

export async function clientLoader() {
  try {
    const recipes = await api("/feed");
    return { recipes: recipes.slice(0, 6) };
  } catch {
    return { recipes: [] };
  }
}

// Lets desktop users scroll a row by dragging with the mouse.
function useDragScroll(dependency) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let down = false;
    let moved = false;
    let startX = 0;
    let startScroll = 0;

    const onPointerDown = (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startScroll = el.scrollLeft;
    };

    const onPointerMove = (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        el.classList.add("is-dragging");
      }
      if (moved) el.scrollLeft = startScroll - dx;
    };

    const onPointerUp = () => {
      down = false;
      el.classList.remove("is-dragging");
    };

    // After a drag, don't open the recipe under the cursor.
    const onClick = (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    };

    // Stop the browser dragging images and links as ghost images.
    const onDragStart = (e) => e.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    el.addEventListener("click", onClick, true);
    el.addEventListener("dragstart", onDragStart);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("dragstart", onDragStart);
    };
  }, [dependency]);

  return ref;
}

function SectionHeading({ id, children, alignRight = false }) {
  return (
    <div
      className={`home-section-heading${alignRight ? " home-section-heading--right" : ""}`}
    >
      <img src={brushStroke} alt="" aria-hidden="true" />
      <h2 id={id}>{children}</h2>
    </div>
  );
}

export default function Home({ loaderData }) {
  const recipes = loaderData?.recipes ?? [];
  const scrollerRef = useDragScroll(recipes.length);

  return (
    <main className="home-mobile">
      <div className="home-greeting">
        <img
          src={greetingBubbleImage}
          alt="Hi Forager! :)"
          className="home-greeting-image"
        />
      </div>

      {/* The exported image already contains the heading and button. */}
      <section className="home-hero" aria-labelledby="home-hero-title">
        <h1 id="home-hero-title" className="home-visually-hidden">
          A walk away from fulfilling food
        </h1>

        <Link
          to="/recipes"
          className="home-hero-link"
          aria-label="Explore recipes"
        >
          <img src={heroImage} alt="" className="home-hero-image" />
        </Link>
      </section>

      <section
        className="home-featured"
        aria-labelledby="home-featured-title"
      >
        <div className="home-content-inset">
          <SectionHeading id="home-featured-title">
            Featured recipes
          </SectionHeading>
        </div>

        {recipes.length > 0 ? (
          <div className="home-featured-scroller" ref={scrollerRef}>
            {recipes.map((recipe) => (
              <div className="home-featured-item" key={recipe.id}>
                <RecipeCard recipe={recipe} />
              </div>
            ))}
          </div>
        ) : (
          <p className="home-content-inset home-featured-empty">
            Public recipes from the community will appear here.
          </p>
        )}

        <div className="home-all-recipes home-content-inset">
          <Link
            to="/recipes"
            className="home-all-recipes-link"
            aria-label="View all recipes"
          >
            <img src={allRecipesButtonImage} alt="" />
          </Link>
        </div>
      </section>

      <div className="home-about-background">
        <section
          className="home-info home-content-inset"
          aria-labelledby="home-about-title"
        >
          <SectionHeading id="home-about-title">Who are we?</SectionHeading>

          <p>
            pine&amp;dandy is a recipe app for people who like to cook with what
            grows around them. We bring together recipes made from wild and
            seasonal ingredients, from nettle soup in spring to elderflower
            cordial in summer and rosehip jam in autumn. You can save recipes,
            share your own, and cook along with the seasons.
          </p>
        </section>

        <section
          className="home-info home-goals home-content-inset"
          aria-labelledby="home-goals-title"
        >
          <SectionHeading id="home-goals-title" alignRight>
            Our goals
          </SectionHeading>

          <p>
            We want to make cooking with wild and seasonal ingredients easy to
            start. pine&amp;dandy helps you find recipes that fit the time of
            year, and gives you a place to save and share them. It is not an
            identification guide, so we always remind you to be sure of a plant
            before you eat it.
          </p>
        </section>
      </div>
    </main>
  );
}