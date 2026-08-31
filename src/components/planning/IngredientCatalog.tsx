"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { IngredientRecord } from "@/types/cookbook-data";

export default function IngredientCatalog({
  ingredients,
}: {
  ingredients: IngredientRecord[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<IngredientRecord["measurementKind"]>("solid");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createIngredient() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, measurementKind: kind }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(result.error || "Creation failed.");

      setName("");
      router.refresh();
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
        <h2 className="font-semibold">Add purchased ingredient</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Bone-in chicken thigh"
            className="border border-zinc-600 bg-black px-3 py-2"
          />
          <select
            value={kind}
            onChange={(event) =>
              setKind(
                event.target.value as IngredientRecord["measurementKind"],
              )
            }
            className="border border-zinc-600 bg-black px-3 py-2"
          >
            <option value="solid">Solid</option>
            <option value="liquid">Liquid</option>
            <option value="countable">Countable</option>
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
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </section>

      <div className="border border-zinc-800">
        {ingredients.length === 0 ? (
          <p className="p-4 text-sm text-zinc-400">
            No purchased ingredients yet.
          </p>
        ) : (
          ingredients.map((ingredient) => (
            <div
              key={ingredient.id}
              className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 last:border-b-0"
            >
              <span>{ingredient.name}</span>
              <span className="text-sm capitalize text-zinc-400">
                {ingredient.measurementKind}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
