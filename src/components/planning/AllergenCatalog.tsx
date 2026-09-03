"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { allergenLabels, type AllergenKey, type LabelIngredient } from "@/lib/labeling-types";

const specificSourceKeys = new Set<AllergenKey>(["fish", "crustacean_shellfish", "tree_nuts"]);

export default function AllergenCatalog({ ingredients }: { ingredients: LabelIngredient[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = ingredients.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 border border-zinc-800 bg-zinc-950 p-3 sm:grid-cols-[1fr_auto] sm:p-4">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search purchased ingredients" className="border border-zinc-700 bg-black px-3 py-2" />
        <div className="self-center text-sm text-zinc-400">
          {ingredients.filter((item) => item.reviewStatus === "confirmed").length} of {ingredients.length} confirmed
        </div>
      </div>

      {shown.map((ingredient) => (
        <IngredientAllergenEditor
          key={ingredient.id}
          ingredient={ingredient}
          open={openId === ingredient.id}
          onToggle={() => setOpenId((current) => current === ingredient.id ? null : ingredient.id)}
          onSaved={() => router.refresh()}
        />
      ))}
    </div>
  );
}

function IngredientAllergenEditor({ ingredient, open, onToggle, onSaved }: {
  ingredient: LabelIngredient;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const [labelName, setLabelName] = useState(ingredient.labelName);
  const [statement, setStatement] = useState(ingredient.ingredientStatement);
  const [keys, setKeys] = useState<AllergenKey[]>(ingredient.allergenKeys);
  const [details, setDetails] = useState(ingredient.allergenDetails);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(confirmed: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/ingredients/${ingredient.id}/labeling`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelName, ingredientStatement: statement, allergenKeys: keys, allergenDetails: details, confirmed }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Save failed.");
      setMessage(confirmed ? "Confirmed." : "Saved for further review.");
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-zinc-800 bg-black">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="font-medium">{ingredient.name}</span>
        <span className={ingredient.reviewStatus === "confirmed" ? "text-sm text-emerald-400" : "text-sm text-amber-300"}>
          {ingredient.reviewStatus === "confirmed" ? "Confirmed" : "Needs review"}
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-zinc-800 p-4">
          <label className="block text-sm text-zinc-300">Label name
            <input value={labelName} onChange={(event) => setLabelName(event.target.value)} className="mt-1 block w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
          </label>
          <label className="block text-sm text-zinc-300">Ingredient declaration
            <textarea value={statement} onChange={(event) => setStatement(event.target.value)} rows={3} className="mt-1 block w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
            <span className="mt-1 block text-xs text-zinc-500">For a commercial compound food, copy its ingredients and subingredients from the supplier label.</span>
          </label>
          <fieldset>
            <legend className="text-sm font-medium">Major allergens present as ingredients</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(Object.entries(allergenLabels) as Array<[AllergenKey, string]>).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 border border-zinc-800 px-3 py-2 text-sm">
                  <input type="checkbox" checked={keys.includes(key)} onChange={(event) => setKeys((current) => event.target.checked ? [...current, key] : current.filter((value) => value !== key))} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {keys.filter((key) => specificSourceKeys.has(key)).map((key) => (
            <label key={key} className="block text-sm text-zinc-300">Specific {allergenLabels[key]} source
              <input value={details[key] ?? ""} onChange={(event) => setDetails((current) => ({ ...current, [key]: event.target.value }))} placeholder={key === "fish" ? "e.g. tilapia" : key === "tree_nuts" ? "e.g. almond" : "e.g. shrimp"} className="mt-1 block w-full border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => save(false)} className="border border-zinc-600 px-4 py-2 disabled:opacity-40">Save draft</button>
            <button type="button" disabled={busy} onClick={() => save(true)} className="border border-emerald-600 px-4 py-2 font-semibold text-emerald-300 disabled:opacity-40">Confirm labeling data</button>
            {message && <span className="text-sm text-zinc-300">{message}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
