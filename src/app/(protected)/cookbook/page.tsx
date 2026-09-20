import Link from "next/link";

import { getCookbookEventChapters } from "@/lib/cookbook-presentation";
import { getRecipes } from "@/lib/recipe-data";

const sections = [
  { key: "main", title: "Main Dishes", description: "The center of the plate." },
  { key: "side", title: "Sides", description: "Vegetables, grains, potatoes, beans, and everything that finishes the meal." },
  { key: "sauce", title: "Sauces", description: "Sauces that deserve to exist as recipes of their own." },
  { key: "dressing", title: "Dressings", description: "Vinaigrettes, Caesar, and other things that make lettuce worth eating." },
  { key: "bread", title: "Bread & Dough", description: "Focaccia and the flour-based infrastructure." },
  { key: "dessert", title: "Desserts", description: "The part people remember when dinner runs long." },
  { key: "component", title: "Components", description: "Stocks, marinades, fillings, and the recipes inside the recipes." },
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

export default async function CookbookPage() {
  const [recipes, events] = await Promise.all([
    getRecipes(),
    getCookbookEventChapters(),
  ]);

  const activeRecipes = recipes.filter((recipe) => recipe.status === "complete");

  return (
    <div className="mx-auto max-w-6xl">
      <header className="border-b border-zinc-800 pb-8 pt-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-zinc-500">
          The Unseen Chef
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">Cookbook</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
          The food, the dinners, and the working recipes behind The Unseen Chef.
          This side of Book is meant to be browsed, not maintained.
        </p>
      </header>

      {events.length > 0 ? (
        <section className="py-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">
              Event Chapters
            </p>
            <h2 className="mt-1 text-2xl font-bold">Dinners worth keeping together</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Menus, stories, and eventually the photographs from special meals.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {events.map((event) => (
              <Link
                key={event.id}
                href={"/cookbook/events/" + event.id}
                className="group overflow-hidden border border-zinc-800 bg-zinc-950 hover:border-zinc-600"
              >
                <div className="flex min-h-48 items-end bg-gradient-to-br from-zinc-900 to-zinc-950 p-5">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      {formatDate(event.eventDate)}
                      {event.guestCount ? " · " + event.guestCount + " guests" : ""}
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold group-hover:text-white">
                      {event.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-400">
                      {event.story}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="border-t border-zinc-800" />

      {sections.map((section) => {
        const sectionRecipes = activeRecipes
          .filter((recipe) => recipe.recipeType === section.key)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (sectionRecipes.length === 0) return null;

        return (
          <section key={section.key} className="border-b border-zinc-800 py-8">
            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
              <div>
                <h2 className="text-2xl font-bold">{section.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{section.description}</p>
                <p className="mt-3 text-xs text-zinc-600">{sectionRecipes.length} recipes</p>
              </div>

              <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                {sectionRecipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={"/cookbook/recipes/" + recipe.id}
                    className="border-b border-zinc-900 py-3 text-sm font-medium text-zinc-200 hover:text-white"
                  >
                    {recipe.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
