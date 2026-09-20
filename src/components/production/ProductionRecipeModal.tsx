"use client";

import { useEffect, useState } from "react";

type RecipeModalTarget = {
  name: string;
  recipeId: string | null;
  photoUrl: string | null;
};

type ReadOnlyRecipe = {
  recipeId: string;
  name: string;
  baseYield: number;
  yieldUnit: string;
  portionQuantity: number | null;
  portionUnit: string | null;
  chefNotes: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    preparationNote: string;
  }>;
  steps: Array<{ id: string; instruction: string }>;
};

function formatQuantity(value: number) {
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(2)).toString();
}

export default function ProductionRecipeModal({
  target,
  onClose,
}: {
  target: RecipeModalTarget | null;
  onClose: () => void;
}) {
  const [recipe, setRecipe] = useState<ReadOnlyRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!target) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [target, onClose]);

  useEffect(() => {
    if (!target) {
      setRecipe(null);
      setError("");
      return;
    }

    if (!target.recipeId) {
      setRecipe(null);
      setError("No recipe is linked to this production item.");
      return;
    }

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      setRecipe(null);

      try {
        const response = await fetch(
          "/api/production/recipe/" + encodeURIComponent(target.recipeId!),
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to load recipe.");
        setRecipe(result as ReadOnlyRecipe);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load recipe.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [target]);

  if (!target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="max-h-[94vh] w-full max-w-5xl overflow-y-auto border border-zinc-600 bg-zinc-950 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={target.name + " recipe"}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-700 bg-zinc-950 px-3 py-2">
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight">{recipe?.name ?? target.name}</h2>
            {recipe ? (
              <div className="mt-0.5 text-xs text-zinc-500">
                Yield {formatQuantity(recipe.baseYield)} {recipe.yieldUnit}
                {recipe.portionQuantity && recipe.portionUnit
                  ? " · Portion " +
                    formatQuantity(recipe.portionQuantity) +
                    " " +
                    recipe.portionUnit
                  : ""}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-700 text-xl leading-none hover:bg-zinc-800"
            aria-label="Close recipe"
          >
            ×
          </button>
        </header>

        {loading ? (
          <div className="p-4 text-sm text-zinc-400">Loading recipe…</div>
        ) : error ? (
          <div className="p-4 text-sm text-red-300">{error}</div>
        ) : recipe ? (
          <div className="p-3">
            {target.photoUrl ? (
              <img
                src={target.photoUrl}
                alt={target.name}
                className="mb-3 max-h-64 w-full object-cover sm:max-h-72"
              />
            ) : null}

            {recipe.chefNotes ? (
              <div className="mb-3 whitespace-pre-line border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300">
                {recipe.chefNotes}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-[0.9fr_1.3fr]">
              <section>
                <h3 className="border-b border-zinc-700 pb-1 text-sm font-bold uppercase tracking-wide">
                  Ingredients
                </h3>
                <div className="divide-y divide-zinc-800">
                  {recipe.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[86px_1fr] gap-2 py-1.5 text-sm"
                    >
                      <div className="font-semibold text-zinc-300">
                        {formatQuantity(item.quantity)} {item.unit}
                      </div>
                      <div>
                        <span>{item.name}</span>
                        {item.preparationNote ? (
                          <span className="ml-1.5 text-xs text-zinc-500">
                            {item.preparationNote}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="border-b border-zinc-700 pb-1 text-sm font-bold uppercase tracking-wide">
                  Procedure
                </h3>
                {recipe.steps.length ? (
                  <ol className="divide-y divide-zinc-800">
                    {recipe.steps.map((step, index) => (
                      <li
                        key={step.id}
                        className="grid grid-cols-[28px_1fr] gap-2 py-1.5 text-sm leading-5"
                      >
                        <span className="font-bold text-zinc-500">{index + 1}</span>
                        <span>{step.instruction}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="py-2 text-sm text-zinc-500">
                    No procedure has been written yet.
                  </div>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
