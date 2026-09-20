"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { allergenLabels, type AllergenKey, type LabelIngredient } from "@/lib/labeling-types";
import type {
  IngredientComponentRecord,
  IngredientKind,
  IngredientRecord,
} from "@/types/cookbook-data";

const allergenEntries = Object.entries(allergenLabels) as Array<[AllergenKey, string]>;

type Draft = {
  id: string;
  name: string;
  measurementKind: IngredientRecord["measurementKind"];
  ingredientKind: IngredientKind;
  labelName: string;
  ingredientStatement: string;
  allergenKeys: AllergenKey[];
  allergenDetails: Partial<Record<AllergenKey, string>>;
  dietaryFlags: string[];
  excludeFromShopping: boolean;
};

export default function IngredientReviewWorkspace({
  ingredients,
  labeling,
  components,
}: {
  ingredients: IngredientRecord[];
  labeling: LabelIngredient[];
  components: IngredientComponentRecord[];
}) {
  const router = useRouter();
  const labelingById = useMemo(
    () => new Map(labeling.map((ingredient) => [ingredient.id, ingredient])),
    [labeling],
  );
  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );
  const componentsByParent = useMemo(() => {
    const map = new Map<string, IngredientComponentRecord[]>();
    for (const component of components) {
      const rows = map.get(component.parentIngredientId) ?? [];
      rows.push(component);
      map.set(component.parentIngredientId, rows);
    }
    return map;
  }, [components]);

  const initialDrafts = useMemo(() => {
    const result: Record<string, Draft> = {};
    for (const ingredient of ingredients) {
      const label = labelingById.get(ingredient.id);
      if (!ingredient.active || ingredient.labelReviewStatus === "confirmed") continue;
      result[ingredient.id] = {
        id: ingredient.id,
        name: ingredient.name,
        measurementKind: ingredient.measurementKind,
        ingredientKind: ingredient.ingredientKind,
        labelName: label?.labelName ?? ingredient.labelName,
        ingredientStatement: label?.ingredientStatement ?? ingredient.ingredientStatement,
        allergenKeys: label?.allergenKeys ?? [],
        allergenDetails: label?.allergenDetails ?? {},
        dietaryFlags: label?.dietaryFlags ?? [],
        excludeFromShopping: ingredient.excludeFromShopping,
      };
    }
    return result;
  }, [ingredients, labelingById]);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newChildByParent, setNewChildByParent] = useState<Record<string, string>>({});

  const normalizedQuery = query.trim().toLowerCase();
  const shownDrafts = Object.values(drafts).filter((draft) =>
    !normalizedQuery
      || draft.name.toLowerCase().includes(normalizedQuery)
      || draft.labelName.toLowerCase().includes(normalizedQuery),
  );

  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  function toggleAllergen(id: string, key: AllergenKey) {
    const draft = drafts[id];
    const next = draft.allergenKeys.includes(key)
      ? draft.allergenKeys.filter((value) => value !== key)
      : [...draft.allergenKeys, key];
    patchDraft(id, { allergenKeys: next });
  }

  async function saveAll() {
    if (shownDrafts.length === 0) return;
    setBusy(true);
    setMessage(`Saving and reviewing ${shownDrafts.length} ingredients…`);
    try {
      const response = await fetch("/api/ingredients/review/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: shownDrafts.map((draft) => ({ ...draft, confirmed: true })),
        }),
      });
      const result = await response.json() as { savedCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Bulk review save failed.");

      setMessage(`Saved and reviewed ${result.savedCount ?? shownDrafts.length} ingredients.`);
      setDrafts((current) => {
        const next = { ...current };
        shownDrafts.forEach((draft) => delete next[draft.id]);
        return next;
      });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk review save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addChild(parentId: string) {
    const childId = newChildByParent[parentId];
    const parent = drafts[parentId];
    if (!childId || !parent) return;

    setBusy(true);
    setMessage("");
    try {
      if (parent.ingredientKind !== "compound") {
        const parentUpdate = { ...parent, ingredientKind: "compound", confirmed: false };
        const parentResponse = await fetch("/api/ingredients/review/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: [parentUpdate] }),
        });
        const parentResult = await parentResponse.json() as { error?: string };
        if (!parentResponse.ok) throw new Error(parentResult.error ?? "Could not make ingredient compound.");
        patchDraft(parentId, { ingredientKind: "compound" });
      }

      const response = await fetch(`/api/ingredients/${parentId}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childIngredientId: childId, sourceText: "" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not add child ingredient.");

      setNewChildByParent((current) => ({ ...current, [parentId]: "" }));
      setMessage("Child ingredient added.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add child ingredient.");
    } finally {
      setBusy(false);
    }
  }

  async function removeChild(parentId: string, componentId: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/ingredients/${parentId}/components`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componentId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not remove child ingredient.");
      setMessage("Child ingredient removed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove child ingredient.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border border-zinc-700 bg-zinc-950 p-3 shadow-xl">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search things that need review"
          className="min-w-60 flex-1 border border-zinc-700 bg-black px-3 py-2"
        />
        <span className="text-sm text-zinc-400">{shownDrafts.length} shown · {Object.keys(drafts).length} remaining</span>
        <button
          type="button"
          onClick={saveAll}
          disabled={busy || shownDrafts.length === 0}
          className="border border-emerald-500 bg-emerald-950/40 px-5 py-2 font-bold text-emerald-200 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save all shown & mark reviewed"}
        </button>
      </div>

      {message && <div className="border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300">{message}</div>}

      {shownDrafts.map((draft) => {
        const childRows = componentsByParent.get(draft.id) ?? [];
        const existingChildIds = new Set(childRows.map((row) => row.childIngredientId));
        const availableChildren = ingredients.filter(
          (candidate) => candidate.id !== draft.id && !existingChildIds.has(candidate.id),
        );

        return (
          <section key={draft.id} className="border border-amber-900/70 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{draft.name}</h2>
              <span className="text-sm text-amber-300">Needs review</span>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_10rem_10rem]">
              <label className="text-sm text-zinc-300">
                Label name
                <input
                  value={draft.labelName}
                  onChange={(event) => patchDraft(draft.id, { labelName: event.target.value })}
                  className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm text-zinc-300">
                Type
                <select
                  value={draft.ingredientKind}
                  onChange={(event) => patchDraft(draft.id, { ingredientKind: event.target.value as IngredientKind })}
                  className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2"
                >
                  <option value="simple">Simple</option>
                  <option value="compound">Compound</option>
                </select>
              </label>
              <label className="text-sm text-zinc-300">
                Measure as
                <select
                  value={draft.measurementKind}
                  onChange={(event) => patchDraft(draft.id, { measurementKind: event.target.value as IngredientRecord["measurementKind"] })}
                  className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2"
                >
                  <option value="solid">Solid</option>
                  <option value="liquid">Liquid</option>
                  <option value="countable">Countable</option>
                </select>
              </label>
            </div>

            <label className="mt-3 block text-sm text-zinc-300">
              Ingredient declaration
              <textarea
                value={draft.ingredientStatement}
                onChange={(event) => patchDraft(draft.id, { ingredientStatement: event.target.value })}
                rows={3}
                placeholder="Paste the supplier ingredient list here."
                className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2 text-white"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Simple item? Leave the ingredient itself. Commercial product? Paste the package ingredient declaration.
              </span>
            </label>

            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Major allergens</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                {allergenEntries.map(([key, label]) => {
                  const selected = draft.allergenKeys.includes(key);
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => toggleAllergen(draft.id, key)}
                      className={selected
                        ? "min-h-11 border border-amber-500 bg-amber-950/50 px-2 py-2 text-xs font-bold text-amber-100"
                        : "min-h-11 border border-zinc-700 px-2 py-2 text-xs text-zinc-500"}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={draft.dietaryFlags.includes("vegetarian")}
                onChange={(event) => patchDraft(draft.id, { dietaryFlags: event.target.checked ? ["vegetarian"] : [] })}
              />
              Vegetarian
            </label>

            {draft.ingredientKind === "compound" && (
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Structured child ingredients</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Add the actual ingredients inside this purchased product. The pasted declaration above remains the supplier wording.
                    </p>
                  </div>
                  {childRows.length === 0 && <span className="text-sm text-amber-300">No child ingredients yet</span>}
                </div>

                <div className="mt-3 space-y-2">
                  {childRows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center gap-3 border border-zinc-800 bg-black px-3 py-2">
                      <span className="min-w-0 flex-1">{ingredientById.get(row.childIngredientId)?.name ?? "Unknown ingredient"}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeChild(draft.id, row.id)}
                        className="border border-red-900 px-2 py-1 text-xs text-red-300 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value={newChildByParent[draft.id] ?? ""}
                    onChange={(event) => setNewChildByParent((current) => ({ ...current, [draft.id]: event.target.value }))}
                    className="min-w-64 flex-1 border border-zinc-700 bg-black px-3 py-2"
                  >
                    <option value="">Choose child ingredient…</option>
                    {availableChildren.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !newChildByParent[draft.id]}
                    onClick={() => addChild(draft.id)}
                    className="border border-blue-600 px-4 py-2 text-blue-300 disabled:opacity-40"
                  >
                    Add child
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      {Object.keys(drafts).length === 0 && (
        <div className="border border-emerald-900 bg-emerald-950/20 p-4 text-emerald-300">
          Ingredient review is clear.
        </div>
      )}
    </div>
  );
}
