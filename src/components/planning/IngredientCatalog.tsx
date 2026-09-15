"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  IngredientComponentRecord,
  IngredientKind,
  IngredientRecord,
} from "@/types/cookbook-data";

type Filter = "all" | "simple" | "compound" | "needs_review";

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/\s+/gu, " ");
}

function declarationLooksPlaceholder(ingredient: IngredientRecord) {
  const statement = normalized(ingredient.ingredientStatement);
  return !statement || statement === normalized(ingredient.name) || statement === normalized(ingredient.labelName);
}

export default function IngredientCatalog({
  ingredients,
  components,
}: {
  ingredients: IngredientRecord[];
  components: IngredientComponentRecord[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [measurementKind, setMeasurementKind] = useState<IngredientRecord["measurementKind"]>("solid");
  const [ingredientKind, setIngredientKind] = useState<IngredientKind>("simple");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMeasurementKind, setEditMeasurementKind] = useState<IngredientRecord["measurementKind"]>("solid");
  const [editIngredientKind, setEditIngredientKind] = useState<IngredientKind>("simple");
  const [editLabelName, setEditLabelName] = useState("");
  const [editStatement, setEditStatement] = useState("");
  const [newChildId, setNewChildId] = useState("");
  const [newChildSourceText, setNewChildSourceText] = useState("");

  const componentsByParent = useMemo(() => {
    const map = new Map<string, IngredientComponentRecord[]>();
    for (const component of components) {
      const rows = map.get(component.parentIngredientId) ?? [];
      rows.push(component);
      map.set(component.parentIngredientId, rows);
    }
    return map;
  }, [components]);

  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );

  function needsReview(ingredient: IngredientRecord) {
    const children = componentsByParent.get(ingredient.id) ?? [];
    return ingredient.labelReviewStatus !== "confirmed"
      || (ingredient.ingredientKind === "compound" && (children.length === 0 || declarationLooksPlaceholder(ingredient)));
  }

  const normalizedQuery = normalized(query);
  const shownIngredients = ingredients.filter((ingredient) => {
    const matchesQuery = !normalizedQuery
      || normalized(ingredient.name).includes(normalizedQuery)
      || normalized(ingredient.labelName).includes(normalizedQuery);
    const matchesFilter = filter === "all"
      || filter === ingredient.ingredientKind
      || (filter === "needs_review" && needsReview(ingredient));
    return matchesQuery && matchesFilter;
  });

  const compoundCount = ingredients.filter((ingredient) => ingredient.ingredientKind === "compound").length;
  const needsReviewCount = ingredients.filter(needsReview).length;

  async function createIngredient() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, measurementKind, ingredientKind }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Creation failed.");
      setName("");
      setIngredientKind("simple");
      router.refresh();
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Creation failed.");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(ingredient: IngredientRecord) {
    setEditingId(ingredient.id);
    setEditName(ingredient.name);
    setEditMeasurementKind(ingredient.measurementKind);
    setEditIngredientKind(ingredient.ingredientKind);
    setEditLabelName(ingredient.labelName);
    setEditStatement(ingredient.ingredientStatement);
    setNewChildId("");
    setNewChildSourceText("");
    setError("");
  }

  async function saveIngredient() {
    if (!editingId || !editName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ingredients/" + editingId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          measurementKind: editMeasurementKind,
          ingredientKind: editIngredientKind,
          labelName: editLabelName,
          ingredientStatement: editStatement,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Save failed.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addChild(parentIngredientId: string) {
    if (!newChildId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/ingredients/${parentIngredientId}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childIngredientId: newChildId,
          sourceText: newChildSourceText,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not add child ingredient.");
      setNewChildId("");
      setNewChildSourceText("");
      router.refresh();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add child ingredient.");
    } finally {
      setBusy(false);
    }
  }

  async function removeChild(parentIngredientId: string, componentId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/ingredients/${parentIngredientId}/components`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componentId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not remove child ingredient.");
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove child ingredient.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <h2 className="font-semibold">Add purchased ingredient</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_10rem_10rem_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Bone-in chicken thigh"
            className="border border-zinc-600 bg-black px-3 py-2"
          />
          <select
            value={measurementKind}
            onChange={(event) => setMeasurementKind(event.target.value as IngredientRecord["measurementKind"])}
            className="border border-zinc-600 bg-black px-3 py-2"
          >
            <option value="solid">Solid</option>
            <option value="liquid">Liquid</option>
            <option value="countable">Countable</option>
          </select>
          <select
            value={ingredientKind}
            onChange={(event) => setIngredientKind(event.target.value as IngredientKind)}
            className="border border-zinc-600 bg-black px-3 py-2"
          >
            <option value="simple">Simple</option>
            <option value="compound">Compound</option>
          </select>
          <button
            type="button"
            onClick={createIngredient}
            disabled={busy || !name.trim()}
            className="border border-blue-500 px-4 py-2 disabled:opacity-40"
          >
            {busy ? "Adding..." : "Add Ingredient"}
          </button>
        </div>
      </section>

      <section className="sticky top-0 z-10 grid gap-3 border border-zinc-700 bg-zinc-950 p-3 shadow-xl sm:grid-cols-[1fr_12rem_auto] sm:p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ingredients"
          className="border border-zinc-700 bg-black px-3 py-2"
        />
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as Filter)}
          className="border border-zinc-700 bg-black px-3 py-2"
        >
          <option value="all">All ingredients</option>
          <option value="simple">Simple</option>
          <option value="compound">Compound ({compoundCount})</option>
          <option value="needs_review">Needs review ({needsReviewCount})</option>
        </select>
        <div className="self-center text-sm text-zinc-400">{shownIngredients.length} shown</div>
      </section>

      {error && <p className="border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}

      <div className="space-y-2">
        {shownIngredients.length === 0 && (
          <p className="border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">No purchased ingredients match this filter.</p>
        )}

        {shownIngredients.map((ingredient) => {
          const ingredientComponents = componentsByParent.get(ingredient.id) ?? [];
          const isEditing = editingId === ingredient.id;
          const reviewNeeded = needsReview(ingredient);

          if (!isEditing) {
            return (
              <div key={ingredient.id} className="flex min-w-0 flex-wrap items-center gap-3 border border-zinc-800 bg-zinc-950 px-4 py-3">
                <button type="button" title="Edit ingredient" onClick={() => beginEdit(ingredient)} className="shrink-0 border border-zinc-600 px-2 py-1">✎</button>
                <span className="min-w-0 flex-1 font-medium">{ingredient.name}</span>
                {ingredient.ingredientKind === "compound" && (
                  <span className="text-xs text-blue-300">Compound · {ingredientComponents.length} children</span>
                )}
                <span className="text-xs capitalize text-zinc-500">{ingredient.measurementKind}</span>
                <span className={reviewNeeded ? "text-xs text-amber-300" : "text-xs text-emerald-400"}>
                  {reviewNeeded ? "Needs review" : "Reviewed"}
                </span>
              </div>
            );
          }

          const existingChildIds = new Set(ingredientComponents.map((component) => component.childIngredientId));
          const availableChildren = ingredients.filter((candidate) => candidate.id !== ingredient.id && !existingChildIds.has(candidate.id));

          return (
            <section key={ingredient.id} className="border border-blue-900 bg-zinc-950 p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto_auto]">
                <input value={editName} onChange={(event) => setEditName(event.target.value)} className="min-w-0 border border-zinc-600 bg-black px-3 py-2" />
                <select value={editMeasurementKind} onChange={(event) => setEditMeasurementKind(event.target.value as IngredientRecord["measurementKind"])} className="border border-zinc-600 bg-black px-2 py-2">
                  <option value="solid">Solid</option>
                  <option value="liquid">Liquid</option>
                  <option value="countable">Countable</option>
                </select>
                <select value={editIngredientKind} onChange={(event) => setEditIngredientKind(event.target.value as IngredientKind)} className="border border-zinc-600 bg-black px-2 py-2">
                  <option value="simple">Simple</option>
                  <option value="compound">Compound</option>
                </select>
                <button type="button" onClick={saveIngredient} disabled={busy || !editName.trim()} className="border border-blue-500 px-3 py-2 disabled:opacity-40">Save</button>
                <button type="button" onClick={() => setEditingId(null)} disabled={busy} className="border border-zinc-600 px-3 py-2 disabled:opacity-40">Close</button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <label className="block text-sm text-zinc-300">
                  Label name
                  <input value={editLabelName} onChange={(event) => setEditLabelName(event.target.value)} className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2 text-white" />
                </label>
                <label className="block text-sm text-zinc-300 lg:row-span-2">
                  Supplier ingredient declaration
                  <textarea value={editStatement} onChange={(event) => setEditStatement(event.target.value)} rows={4} className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2 text-white" />
                  <span className="mt-1 block text-xs text-zinc-500">For a commercial compound food, preserve the full manufacturer declaration including subingredients.</span>
                </label>
                <div className="text-xs text-zinc-500">
                  Label review: <span className={ingredient.labelReviewStatus === "confirmed" ? "text-emerald-400" : "text-amber-300"}>{ingredient.labelReviewStatus === "confirmed" ? "reviewed" : "needs review"}</span>. Changing type or declaration returns it to review.
                </div>
              </div>

              {editIngredientKind === "compound" && (
                <div className="mt-5 border-t border-zinc-800 pt-4">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">Structured child ingredients</h3>
                      <p className="mt-1 text-xs text-zinc-500">These relationships power recursive labels, allergens, and future nutrition. Do not enter guessed manufacturer quantities.</p>
                    </div>
                    {ingredientComponents.length === 0 && <span className="text-sm text-amber-300">No child ingredients yet</span>}
                  </div>

                  <div className="mt-3 space-y-2">
                    {ingredientComponents.map((component, index) => {
                      const child = ingredientById.get(component.childIngredientId);
                      return (
                        <div key={component.id} className="flex flex-wrap items-center gap-3 border border-zinc-800 bg-black px-3 py-2">
                          <span className="w-6 text-right text-xs text-zinc-600">{index + 1}</span>
                          <span className="min-w-0 flex-1">{child?.name ?? "Unknown ingredient"}</span>
                          {component.sourceText && <span className="max-w-full text-xs text-zinc-500">Supplier wording: {component.sourceText}</span>}
                          <button type="button" disabled={busy} onClick={() => removeChild(ingredient.id, component.id)} className="border border-red-900 px-2 py-1 text-xs text-red-300 disabled:opacity-40">Remove</button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto]">
                    <select value={newChildId} onChange={(event) => setNewChildId(event.target.value)} className="border border-zinc-700 bg-black px-3 py-2">
                      <option value="">Choose child ingredient…</option>
                      {availableChildren.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
                    </select>
                    <input value={newChildSourceText} onChange={(event) => setNewChildSourceText(event.target.value)} placeholder="Supplier wording (optional)" className="border border-zinc-700 bg-black px-3 py-2" />
                    <button type="button" disabled={busy || !newChildId || ingredient.ingredientKind !== "compound"} onClick={() => addChild(ingredient.id)} className="border border-emerald-700 px-4 py-2 text-emerald-300 disabled:opacity-40">Add child</button>
                  </div>
                  {ingredient.ingredientKind !== "compound" && editIngredientKind === "compound" && (
                    <p className="mt-2 text-xs text-amber-300">Save the ingredient as Compound before adding child ingredients.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
