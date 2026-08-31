"use client";

import { useState } from "react";
import Link from "next/link";
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [existingRecipeId, setExistingRecipeId] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"main" | "component">("main");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  function open(item: MenuItemRecord) {
    setOpenId((current) => (current === item.id ? null : item.id));
    setExistingRecipeId("");
    setNewName(item.shortName || item.name);
    setNewType("main");
    setError("");
  }

  async function attach(menuItemId: string, recipeId: string, role: string) {
    const response = await fetch("/api/menu-item-recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId, recipeId, role }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(result.error || "Recipe could not be attached.");
    }
  }

  async function attachExisting(menuItemId: string) {
    if (!existingRecipeId) return;
    const recipe = recipesById.get(existingRecipeId);
    if (!recipe) return;
    setBusy(true);
    setError("");

    try {
      await attach(
        menuItemId,
        recipe.id,
        recipe.recipeType === "component" ? "component" : "main",
      );
      setExistingRecipeId("");
      router.push("/planning/recipes/" + recipe.id);
    } catch (attachError) {
      setError(
        attachError instanceof Error ? attachError.message : "Attach failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createAndAttach(menuItemId: string) {
    if (!newName.trim()) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, recipeType: newType }),
      });
      const result = (await response.json()) as {
        id?: string;
        error?: string;
      };

      if (!response.ok || !result.id) {
        throw new Error(result.error || "Recipe could not be created.");
      }

      await attach(
        menuItemId,
        result.id,
        newType === "component" ? "component" : "main",
      );
      setNewName("");
      router.push("/planning/recipes/" + result.id);
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "Creation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-3 text-sm text-zinc-400">
        {items.length} catalog item{items.length === 1 ? "" : "s"}
      </div>

      <div className="overflow-x-auto border border-zinc-800">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="bg-zinc-950 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Menu item</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Protein</th>
              <th className="px-3 py-2">Default sides</th>
              <th className="px-3 py-2">Recipes</th>
              <th className="px-3 py-2">Plan</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const itemLinks = links.filter(
                (link) => link.menuItemId === item.id,
              );

              return [
                <tr
                  key={item.id}
                  className="border-t border-zinc-800"
                >
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
                      onClick={() => open(item)}
                      className="border border-blue-500 px-3 py-1"
                    >
                      {openId === item.id ? "Close" : "Add / Edit Recipes"}
                    </button>
                  </td>
                </tr>,
                openId === item.id ? (
                  <tr key={item.id + ":planner"}>
                    <td
                      colSpan={7}
                      className="border-t border-blue-900 bg-zinc-950 p-4"
                    >
                      <div className="grid gap-5 lg:grid-cols-2">
                        <section>
                          <h3 className="font-semibold">
                            Attach existing recipe or component
                          </h3>
                          <div className="mt-3 flex gap-2">
                            <select
                              value={existingRecipeId}
                              onChange={(event) =>
                                setExistingRecipeId(event.target.value)
                              }
                              className="min-w-0 flex-1 border border-zinc-600 bg-black px-3 py-2"
                            >
                              <option value="">Choose existing</option>
                              {recipes.map((recipe) => (
                                <option key={recipe.id} value={recipe.id}>
                                  {recipe.name} ({recipe.recipeType})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={busy || !existingRecipeId}
                              onClick={() => attachExisting(item.id)}
                              className="border border-blue-500 px-3 py-2 disabled:opacity-40"
                            >
                              Attach & Open
                            </button>
                          </div>
                        </section>

                        <section>
                          <h3 className="font-semibold">
                            Create and attach draft
                          </h3>
                          <div className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                            <select
                              value={newType}
                              onChange={(event) =>
                                setNewType(
                                  event.target.value as "main" | "component",
                                )
                              }
                              className="border border-zinc-600 bg-black px-3 py-2"
                            >
                              <option value="main">Main recipe</option>
                              <option value="component">Component</option>
                            </select>
                            <input
                              value={newName}
                              onChange={(event) =>
                                setNewName(event.target.value)
                              }
                              className="border border-zinc-600 bg-black px-3 py-2"
                            />
                            <button
                              type="button"
                              disabled={busy || !newName.trim()}
                              onClick={() => createAndAttach(item.id)}
                              className="border border-blue-500 px-3 py-2 disabled:opacity-40"
                            >
                              {busy ? "Saving..." : "Create & Open"}
                            </button>
                          </div>
                        </section>
                      </div>
                      {error && (
                        <p className="mt-3 text-sm text-red-300">{error}</p>
                      )}
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
