"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { RecipeRecord } from "@/types/cookbook-data";

export default function RecipeCatalog({
  recipes,
  recipeType,
  emptyMessage,
}: {
  recipes: RecipeRecord[];
  recipeType: "main" | "component";
  emptyMessage: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createRecipe() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, recipeType }),
      });
      const result = (await response.json()) as {
        id?: string;
        error?: string;
      };

      if (!response.ok || !result.id) {
        throw new Error(result.error || "Creation failed.");
      }

      setName("");
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
    <div className="mt-6 space-y-5">
      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <h2 className="font-semibold">
          Add draft {recipeType === "component" ? "component" : "main recipe"}
        </h2>
        <div className="mt-3 flex gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              recipeType === "component" ? "Adobo Marinade" : "Chicken Adobo"
            }
            className="min-w-0 flex-1 border border-zinc-600 bg-black px-3 py-2"
          />
          <button
            type="button"
            onClick={createRecipe}
            disabled={busy || !name.trim()}
            className="border border-blue-500 px-4 py-2 disabled:opacity-40"
          >
            {busy ? "Adding..." : "Create & Open"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </section>

      <div className="border border-zinc-800">
        {recipes.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">{emptyMessage}</p>
        ) : (
          recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 last:border-b-0"
            >
              <Link
                href={"/planning/recipes/" + recipe.id}
                className="text-blue-300 hover:underline"
              >
                {recipe.name}
              </Link>
              <div className="flex items-center gap-3">
                <span
                  className={
                    recipe.status === "complete"
                      ? "text-sm text-emerald-400"
                      : "text-sm text-amber-300"
                  }
                >
                  {recipe.status === "complete" ? "Complete" : "Draft"}
                </span>
                <Link
                  href={"/planning/recipes/" + recipe.id}
                  className="border border-blue-500 px-3 py-1 text-sm"
                >
                  Edit Recipe
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
