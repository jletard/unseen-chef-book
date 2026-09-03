"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  MenuItemRecord,
  MenuItemRecipeLink,
  RecipeRecord,
} from "@/types/cookbook-data";

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

type SortKey =
  | "name"
  | "type"
  | "category"
  | "protein"
  | "sides"
  | "recipes";

export default function MenuItemCatalog({
  items,
  recipes,
  links,
}: {
  items: MenuItemRecord[];
  recipes: RecipeRecord[];
  links: MenuItemRecipeLink[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));


  const sortedItems = useMemo(() => {
    const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    function value(item: MenuItemRecord) {
      const itemLinks = links.filter((link) => link.menuItemId === item.id);
      if (sortKey === "name") return item.shortName || item.name;
      if (sortKey === "type") return item.menuType;
      if (sortKey === "category") return item.category || "";
      if (sortKey === "protein") return item.proteinType || "";
      if (sortKey === "sides") return item.sides.join(" ");
      return itemLinks
        .map((link) => recipeMap.get(link.recipeId)?.name || "")
        .join(" ");
    }

    return [...items].sort((left, right) => {
      const result = value(left).localeCompare(value(right), undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? result : -result;
    });
  }, [items, links, recipes, sortKey, sortDirection]);

  function changeSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(nextKey);
      setSortDirection("asc");
    }
  }

  function sortHeader(key: SortKey, text: string) {
    const arrow = sortKey === key ? (sortDirection === "asc" ? " ▲" : " ▼") : "";
    return (
      <button
        type="button"
        onClick={() => changeSort(key)}
        className="whitespace-nowrap text-left hover:text-zinc-200"
      >
        {text}{arrow}
      </button>
    );
  }

  async function attach(menuItemId: string, recipeId: string) {
    const response = await fetch("/api/menu-item-recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId, recipeId, role: "main" }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(result.error || "Recipe could not be attached.");
    }
  }

  async function openRecipe(
    item: MenuItemRecord,
    itemLinks: MenuItemRecipeLink[],
  ) {
    const linked =
      itemLinks
        .map((link) => ({
          link,
          recipe: recipesById.get(link.recipeId),
        }))
        .find(({ link, recipe }) => recipe && link.role === "main")?.recipe ??
      itemLinks
        .map((link) => recipesById.get(link.recipeId))
        .find((recipe) => recipe);

    if (linked) {
      router.push("/planning/recipes/" + linked.id);
      return;
    }

    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.shortName || item.name,
          recipeType: "main",
        }),
      });
      const result = (await response.json()) as {
        id?: string;
        error?: string;
      };
      if (!response.ok || !result.id) {
        throw new Error(result.error || "Recipe could not be created.");
      }
      await attach(item.id, result.id);
      router.push("/planning/recipes/" + result.id);
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "Recipe could not be opened.",
      );
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-3 text-sm text-zinc-400">
        {items.length} catalog item{items.length === 1 ? "" : "s"}
      </div>

      {error ? (
        <p className="mb-3 border border-red-800 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="space-y-3 md:hidden">
        {sortedItems.map((item) => {
          const itemLinks = links.filter((link) => link.menuItemId === item.id);
          const linkedRecipes = itemLinks
            .map((link) => recipesById.get(link.recipeId))
            .filter((recipe): recipe is RecipeRecord => Boolean(recipe));
          return (
            <article key={item.id} className="border border-zinc-800 bg-black p-4">
              <h2 className="font-semibold text-zinc-100">{item.shortName || item.name}</h2>
              {item.description && <p className="mt-1 text-sm text-zinc-400">{item.description}</p>}
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div><dt className="text-xs uppercase text-zinc-500">Type</dt><dd>{label(item.menuType)}</dd></div>
                <div><dt className="text-xs uppercase text-zinc-500">Protein</dt><dd>{item.proteinType || "—"}</dd></div>
                <div className="col-span-2"><dt className="text-xs uppercase text-zinc-500">Category</dt><dd>{item.category || "—"}</dd></div>
                <div className="col-span-2"><dt className="text-xs uppercase text-zinc-500">Default sides</dt><dd>{item.sides.length ? item.sides.join(" · ") : "—"}</dd></div>
                <div className="col-span-2">
                  <dt className="text-xs uppercase text-zinc-500">Recipes</dt>
                  <dd>{linkedRecipes.length ? linkedRecipes.map((recipe) => recipe.name).join(" · ") : "Not defined"}</dd>
                </div>
              </dl>
              <button
                type="button"
                disabled={busyId !== null}
                onClick={() => openRecipe(item, itemLinks)}
                className="mt-4 w-full border border-blue-500 px-3 py-2 font-medium disabled:opacity-40"
              >
                {busyId === item.id ? "Opening..." : itemLinks.length ? "Open Recipe" : "Create Recipe"}
              </button>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto border border-zinc-800 md:block">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="bg-zinc-950 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">{sortHeader("name", "Menu item")}</th>
              <th className="px-3 py-2">{sortHeader("type", "Type")}</th>
              <th className="px-3 py-2">{sortHeader("category", "Category")}</th>
              <th className="px-3 py-2">{sortHeader("protein", "Protein")}</th>
              <th className="px-3 py-2">{sortHeader("sides", "Default sides")}</th>
              <th className="px-3 py-2">{sortHeader("recipes", "Recipes")}</th>
              <th className="px-3 py-2">Plan</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => {
              const itemLinks = links.filter(
                (link) => link.menuItemId === item.id,
              );
              return (
                <tr key={item.id} className="border-t border-zinc-800">
                  <td className="max-w-md px-3 py-2">
                    <div className="font-medium text-zinc-100">
                      {item.shortName || item.name}
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {item.description}
                    </div>
                  </td>
                  <td className="px-3 py-2">{label(item.menuType)}</td>
                  <td className="px-3 py-2">{item.category || "—"}</td>
                  <td className="px-3 py-2">{item.proteinType || "—"}</td>
                  <td className="px-3 py-2">
                    {item.sides.length ? item.sides.join(" · ") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {itemLinks.length ? (
                      <span className="flex flex-wrap gap-x-2 gap-y-1">
                        {itemLinks.map((link) => {
                          const linkedRecipe = recipesById.get(link.recipeId);
                          return linkedRecipe ? (
                            <Link
                              key={link.id}
                              href={"/planning/recipes/" + linkedRecipe.id}
                              className="text-blue-300 hover:underline"
                            >
                              {linkedRecipe.name}
                            </Link>
                          ) : null;
                        })}
                      </span>
                    ) : (
                      "Not defined"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => openRecipe(item, itemLinks)}
                      className="border border-blue-500 px-3 py-1 disabled:opacity-40"
                    >
                      {busyId === item.id
                        ? "Opening..."
                        : itemLinks.length
                          ? "Open Recipe"
                          : "Create Recipe"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
