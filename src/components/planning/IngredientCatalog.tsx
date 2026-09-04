"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { IngredientRecord } from "@/types/cookbook-data";

export default function IngredientCatalog({ ingredients }: { ingredients: IngredientRecord[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<IngredientRecord["measurementKind"]>("solid");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<IngredientRecord["measurementKind"]>("solid");

  async function createIngredient() {
    if (!name.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/ingredients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, measurementKind: kind }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Creation failed.");
      setName(""); router.refresh();
    } catch (creationError) { setError(creationError instanceof Error ? creationError.message : "Creation failed."); }
    finally { setBusy(false); }
  }

  function beginEdit(ingredient: IngredientRecord) {
    setEditingId(ingredient.id); setEditName(ingredient.name); setEditKind(ingredient.measurementKind); setError("");
  }

  async function saveIngredient() {
    if (!editingId || !editName.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/ingredients/" + editingId, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName, measurementKind: editKind }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Save failed.");
      setEditingId(null); router.refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Save failed."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-6 space-y-5">
      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <h2 className="font-semibold">Add purchased ingredient</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bone-in chicken thigh" className="border border-zinc-600 bg-black px-3 py-2" />
          <select value={kind} onChange={(e) => setKind(e.target.value as IngredientRecord["measurementKind"])} className="border border-zinc-600 bg-black px-3 py-2"><option value="solid">Solid</option><option value="liquid">Liquid</option><option value="countable">Countable</option></select>
          <button type="button" onClick={createIngredient} disabled={busy || !name.trim()} className="border border-blue-500 px-4 py-2 disabled:opacity-40">{busy ? "Adding..." : "Add Ingredient"}</button>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </section>

      <div className="grid grid-cols-1 gap-px bg-zinc-800 border border-zinc-800 md:grid-cols-2">
        {ingredients.length === 0 ? <p className="col-span-full bg-zinc-950 p-4 text-sm text-zinc-400">No purchased ingredients yet.</p> : ingredients.map((ingredient) => editingId === ingredient.id ? (
          <div key={ingredient.id} className="grid gap-2 bg-zinc-950 p-3 sm:grid-cols-[1fr_9rem_auto_auto]">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="min-w-0 border border-zinc-600 bg-black px-3 py-2" />
            <select value={editKind} onChange={(e) => setEditKind(e.target.value as IngredientRecord["measurementKind"])} className="border border-zinc-600 bg-black px-2 py-2"><option value="solid">Solid</option><option value="liquid">Liquid</option><option value="countable">Countable</option></select>
            <button type="button" onClick={saveIngredient} disabled={busy || !editName.trim()} className="border border-blue-500 px-2 py-2 disabled:opacity-40">Save</button>
            <button type="button" onClick={() => setEditingId(null)} disabled={busy} className="border border-zinc-600 px-2 py-2 disabled:opacity-40">Cancel</button>
          </div>
        ) : (
          <div key={ingredient.id} className="flex min-w-0 items-center gap-3 bg-zinc-950 px-4 py-3">
            <button type="button" title="Edit ingredient" onClick={() => beginEdit(ingredient)} className="shrink-0 border border-zinc-600 px-2 py-1">✎</button>
            <span className="min-w-0 flex-1 truncate">{ingredient.name}</span>
            <span className="shrink-0 text-sm capitalize text-zinc-400">{ingredient.measurementKind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
