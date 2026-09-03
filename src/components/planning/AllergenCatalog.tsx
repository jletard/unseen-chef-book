"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { allergenLabels, type AllergenKey, type LabelIngredient } from "@/lib/labeling-types";

const allergenEntries = Object.entries(allergenLabels) as Array<[AllergenKey, string]>;

export default function AllergenCatalog({ ingredients }: { ingredients: LabelIngredient[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<"all" | "needs_review" | "reviewed">("all");
  const [editMode, setEditMode] = useState(false);
  const [saveAllMessage, setSaveAllMessage] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, LabelingUpdate>>({});
  const normalizedQuery = query.trim().toLowerCase();
  const isShown = (item: LabelIngredient) => {
    const matchesQuery = item.name.toLowerCase().includes(normalizedQuery);
    const matchesReview = reviewFilter === "all"
      || (reviewFilter === "reviewed" && item.reviewStatus === "confirmed")
      || (reviewFilter === "needs_review" && item.reviewStatus !== "confirmed");
    return matchesQuery && matchesReview;
  };
  const shownCount = ingredients.filter(isShown).length;

  const recordPendingUpdate = useCallback((update: LabelingUpdate) => {
    setPendingUpdates((current) => ({ ...current, [update.id]: update }));
  }, []);

  const recordSaved = useCallback((ingredientId: string) => {
    setPendingUpdates((current) => {
      const next = { ...current };
      delete next[ingredientId];
      return next;
    });
    router.refresh();
  }, [router]);

  async function saveAllChanges() {
    const targets = ingredients
      .filter((ingredient) => isShown(ingredient) && (ingredient.reviewStatus !== "confirmed" || pendingUpdates[ingredient.id]))
      .map((ingredient) => pendingUpdates[ingredient.id] ?? updateFromIngredient(ingredient));
    if (targets.length === 0) {
      setSaveAllMessage("Nothing visible needs review and there are no unsaved changes.");
      return;
    }
    setBulkSaving(true);
    setSaveAllMessage(`Saving ${targets.length} ${targets.length === 1 ? "ingredient" : "ingredients"}…`);
    try {
      const response = await fetch("/api/ingredients/labeling/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: targets.map((target) => ({ ...target, confirmed: true })) }),
      });
      const result = await response.json() as { savedCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Bulk save failed.");
      setPendingUpdates((current) => {
        const next = { ...current };
        targets.forEach((target) => delete next[target.id]);
        return next;
      });
      setSaveAllMessage(`Saved and reviewed ${result.savedCount ?? targets.length} ingredients.`);
      router.refresh();
    } catch (error) {
      setSaveAllMessage(error instanceof Error ? error.message : "Bulk save failed. No completed changes were discarded.");
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="sticky top-0 z-10 grid gap-3 border border-zinc-700 bg-zinc-950 p-3 shadow-xl sm:grid-cols-[1fr_auto_auto_auto] sm:p-4">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search purchased ingredients" className="border border-zinc-700 bg-black px-3 py-2" />
        <select
          value={reviewFilter}
          onChange={(event) => setReviewFilter(event.target.value as "all" | "needs_review" | "reviewed")}
          aria-label="Filter by review status"
          className="border border-zinc-700 bg-black px-3 py-2"
        >
          <option value="all">All ingredients</option>
          <option value="needs_review">Needs review</option>
          <option value="reviewed">Reviewed</option>
        </select>
        <div className="self-center text-sm text-zinc-400">
          {ingredients.filter((item) => item.reviewStatus === "confirmed").length} of {ingredients.length} reviewed
        </div>
        <button
          type="button"
          aria-pressed={editMode}
          onClick={() => setEditMode((current) => !current)}
          className={editMode
            ? "border border-amber-500 bg-amber-950/40 px-4 py-2 font-semibold text-amber-200"
            : "border border-blue-600 px-4 py-2 font-semibold text-blue-300"}
        >
          {editMode ? "Finish editing" : "Edit flags"}
        </button>
      </div>

      {shownCount === 0 && <p className="border border-zinc-800 p-4 text-zinc-400">No ingredients match this filter.</p>}
      {ingredients.map((ingredient) => (
        <div key={ingredient.id} className={isShown(ingredient) ? "block" : "hidden"}>
          <IngredientFlags
            ingredient={ingredient}
            editMode={editMode}
            onChanged={recordPendingUpdate}
            onSaved={recordSaved}
          />
        </div>
      ))}

      {editMode && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border border-zinc-700 bg-zinc-950 p-3 shadow-2xl sm:p-4">
          {saveAllMessage && <span className="text-sm text-zinc-400">{saveAllMessage}</span>}
          <button type="button" disabled={bulkSaving} onClick={saveAllChanges} className="border border-emerald-500 bg-emerald-950/40 px-5 py-3 font-bold text-emerald-200 disabled:opacity-40">
            {bulkSaving ? "Saving…" : "Save all changes"}
          </button>
        </div>
      )}
    </div>
  );
}

type LabelingUpdate = {
  id: string;
  labelName: string;
  ingredientStatement: string;
  allergenKeys: AllergenKey[];
  allergenDetails: Partial<Record<AllergenKey, string>>;
  dietaryFlags: string[];
  confirmed: boolean;
};

function updateFromIngredient(ingredient: LabelIngredient): LabelingUpdate {
  return {
    id: ingredient.id,
    labelName: ingredient.labelName,
    ingredientStatement: ingredient.ingredientStatement,
    allergenKeys: ingredient.allergenKeys,
    allergenDetails: ingredient.allergenDetails,
    dietaryFlags: ingredient.dietaryFlags,
    confirmed: true,
  };
}

function IngredientFlags({ ingredient, editMode, onChanged, onSaved }: { ingredient: LabelIngredient; editMode: boolean; onChanged: (update: LabelingUpdate) => void; onSaved: (ingredientId: string) => void }) {
  const [labelName, setLabelName] = useState(ingredient.labelName);
  const [statement, setStatement] = useState(ingredient.ingredientStatement);
  const [keys, setKeys] = useState<AllergenKey[]>(ingredient.allergenKeys);
  const details = ingredient.allergenDetails;
  const [vegetarian, setVegetarian] = useState(ingredient.dietaryFlags.includes("vegetarian"));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!dirty) return;
    onChanged({
      id: ingredient.id,
      labelName,
      ingredientStatement: statement,
      allergenKeys: keys,
      allergenDetails: details,
      dietaryFlags: vegetarian ? ["vegetarian"] : [],
      confirmed: true,
    });
  }, [details, dirty, ingredient.id, keys, labelName, onChanged, statement, vegetarian]);

  function toggleKey(key: AllergenKey) {
    if (!editMode || busy) return;
    setKeys((current) => current.includes(key) ? current.filter((value) => value !== key) : [...current, key]);
    setDirty(true);
    setMessage("Unsaved changes");
  }

  async function save(confirmed: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/ingredients/${ingredient.id}/labeling`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labelName,
          ingredientStatement: statement,
          allergenKeys: keys,
          allergenDetails: details,
          dietaryFlags: vegetarian ? ["vegetarian"] : [],
          confirmed,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Save failed.");
      setMessage(confirmed ? "Reviewed" : "Saved");
      setDirty(false);
      onSaved(ingredient.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-zinc-800 bg-black p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">{ingredient.name}</h2>
        <span className={ingredient.reviewStatus === "confirmed" ? "text-sm text-emerald-400" : "text-sm text-amber-300"}>
          {ingredient.reviewStatus === "confirmed" ? "Reviewed" : "Needs review"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
        {allergenEntries.map(([key, label]) => {
          const selected = keys.includes(key);
          return (
            <button
              type="button"
              key={key}
              disabled={!editMode || busy}
              aria-pressed={selected}
              onClick={() => toggleKey(key)}
              className={selected
                ? "min-h-12 border border-amber-500 bg-amber-950/50 px-2 py-2 text-xs font-bold text-amber-100 disabled:opacity-100"
                : "min-h-12 border border-zinc-700 px-2 py-2 text-xs text-zinc-500 disabled:opacity-100"}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          disabled={!editMode || busy}
          aria-pressed={vegetarian}
          onClick={() => { setVegetarian((current) => !current); setDirty(true); setMessage("Unsaved changes"); }}
          className={vegetarian
            ? "min-h-12 border border-emerald-500 bg-emerald-950/50 px-2 py-2 text-xs font-bold text-emerald-100 disabled:opacity-100"
            : "min-h-12 border border-zinc-700 px-2 py-2 text-xs text-zinc-500 disabled:opacity-100"}
        >
          Vegetarian
        </button>
      </div>

      {editMode && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <button type="button" onClick={() => setDetailsOpen((current) => !current)} className="border border-zinc-700 px-3 py-2 text-sm text-zinc-300">
            {detailsOpen ? "Hide ingredient wording" : "Edit ingredient wording"}
          </button>
          {detailsOpen && (
            <div className="mt-3 grid gap-3">
              <label className="block text-sm text-zinc-300">Label name
                <input value={labelName} onChange={(event) => { setLabelName(event.target.value); setDirty(true); setMessage("Unsaved changes"); }} className="mt-1 block w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
              </label>
              <label className="block text-sm text-zinc-300">Ingredient declaration
                <textarea value={statement} onChange={(event) => { setStatement(event.target.value); setDirty(true); setMessage("Unsaved changes"); }} rows={3} className="mt-1 block w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
                <span className="mt-1 block text-xs text-zinc-500">For a commercial compound food, copy its ingredients and subingredients from the supplier label.</span>
              </label>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => save(false)} className="border border-zinc-600 px-4 py-2 disabled:opacity-40">Save</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => save(true)}
              className="border border-emerald-500 bg-emerald-950/40 px-4 py-2 font-semibold text-emerald-200 disabled:opacity-40"
            >
              Save &amp; mark reviewed
            </button>
            {message && <span className="text-sm text-zinc-400">{message}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
