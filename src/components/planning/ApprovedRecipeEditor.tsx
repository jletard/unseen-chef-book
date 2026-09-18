"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import SecretAIImportBox from "@/components/SecretAIImportBox/SecretAIImportBox";
import { createSingleRecipeDraftSchema } from "@/lib/cookbook-v2/secret-ai-batch";
import type { ApprovedRecipeEditorData } from "@/lib/recipe-data";

const yieldUnits: Record<string, string[]> = {
  servings: ["serving"],
  liquid: ["fl_oz", "cup", "quart"],
  solid: ["oz", "lb", "g", "kg"],
  countable: ["each"],
};

const allUnits = ["each", "serving", "tsp", "tbsp", "fl_oz", "cup", "quart", "oz", "lb", "g", "kg"];

export default function ApprovedRecipeEditor({ data }: { data: ApprovedRecipeEditorData }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => structuredClone(data));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function setField<K extends keyof ApprovedRecipeEditorData>(key: K, value: ApprovedRecipeEditorData[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateItem(index: number, patch: Partial<ApprovedRecipeEditorData["items"][number]>) {
    setDraft((current) => {
      const items = [...current.items];
      const next = { ...items[index], ...patch };
      if (patch.kind || patch.sourceId) {
        const options = next.kind === "ingredient" ? current.ingredientOptions : current.componentOptions;
        next.name = options.find((option) => option.id === next.sourceId)?.name ?? "";
      }
      items[index] = next;
      return { ...current, items };
    });
  }

  async function acceptAIRevision(values: Record<string, unknown>) {
    const imported = values as {
      draft?: {
        name?: string;
        recipeCategory?: string;
        yieldKind?: string;
        baseYield?: number;
        yieldUnit?: string;
        minimumBatchQuantity?: number;
        minimumBatchUnit?: string;
        portionQuantity?: number;
        portionUnit?: string;
        chefNotes?: string;
        items?: Array<{
          id?: string;
          kind?: "ingredient" | "recipe";
          proposedName?: string;
          quantity?: number;
          unit?: string;
          preparationNote?: string;
        }>;
        steps?: Array<{ id?: string; instruction?: string }>;
      };
    };
    const next = imported.draft;
    if (!next) throw new Error("AI+ did not return a recipe draft.");

    const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
    const currentById = new Map(draft.items.map((item) => [item.id, item]));

    const items: ApprovedRecipeEditorData["items"] = (next.items ?? []).map((item, index) => {
      const kind: "ingredient" | "recipe" = item.kind === "recipe" ? "recipe" : "ingredient";
      const name = String(item.proposedName ?? "").trim();
      const options = kind === "ingredient" ? draft.ingredientOptions : draft.componentOptions;
      const matched = options.find((option) => normalizeName(option.name) === normalizeName(name));
      const current = item.id ? currentById.get(item.id) : undefined;
      const unchangedCurrent =
        current &&
        current.kind === kind &&
        normalizeName(current.name) === normalizeName(name)
          ? current
          : undefined;
      const sourceId = matched?.id ?? unchangedCurrent?.sourceId ?? "";
      if (!sourceId) {
        throw new Error(`"${name || `item ${index + 1}`}" is not an existing ${kind === "ingredient" ? "ingredient" : "approved component"} in Book yet.`);
      }
      return {
        id: item.id || crypto.randomUUID(),
        kind,
        sourceId,
        name: matched?.name ?? unchangedCurrent?.name ?? name,
        quantity: Number(item.quantity ?? 0),
        unit: String(item.unit ?? "g"),
        preparationNote: String(item.preparationNote ?? ""),
      };
    });

    setDraft((current) => ({
      ...current,
      name: String(next.name ?? current.name),
      recipeType: String(next.recipeCategory ?? current.recipeType),
      yieldKind: String(next.yieldKind ?? current.yieldKind),
      baseYield: Number(next.baseYield ?? current.baseYield),
      yieldUnit: String(next.yieldUnit ?? current.yieldUnit),
      minimumBatchQuantity: Number(next.minimumBatchQuantity ?? current.minimumBatchQuantity),
      minimumBatchUnit: String(next.minimumBatchUnit ?? current.minimumBatchUnit),
      portionQuantity: next.portionQuantity == null ? null : Number(next.portionQuantity),
      portionUnit: next.portionUnit ? String(next.portionUnit) : null,
      chefNotes: String(next.chefNotes ?? current.chefNotes),
      items,
      steps: (next.steps ?? []).map((step) => ({
        id: step.id || crypto.randomUUID(),
        instruction: String(step.instruction ?? ""),
      })),
    }));
    setMessage("AI+ revision loaded into the editor. Review it, then save the new approved version.");
    setError("");
  }

  async function save() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/recipes/" + data.recipeId + "/approved-version", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          recipeType: draft.recipeType,
          yieldKind: draft.yieldKind,
          baseYield: draft.baseYield,
          yieldUnit: draft.yieldUnit,
          minimumBatchQuantity: draft.minimumBatchQuantity,
          minimumBatchUnit: draft.minimumBatchUnit,
          portionQuantity: draft.portionQuantity,
          portionUnit: draft.portionUnit,
          chefNotes: draft.chefNotes,
          items: draft.items.map((item) => ({
            kind: item.kind,
            sourceId: item.sourceId,
            quantity: item.quantity,
            unit: item.unit,
            preparationNote: item.preparationNote,
          })),
          steps: draft.steps.map((step) => ({ instruction: step.instruction })),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Recipe could not be saved.");
      setMessage("Saved as a new approved version.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Recipe could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}

      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">Recipe definition</h2>
          <div className="ml-auto flex max-w-full flex-wrap items-start justify-end gap-3">
            <span className="pt-1 text-emerald-400">Approved</span>
            <SecretAIImportBox
              formSchema={createSingleRecipeDraftSchema(draft.name)}
              currentValues={{
                draft: {
                  name: draft.name,
                  recipeCategory: draft.recipeType,
                  yieldKind: draft.yieldKind,
                  baseYield: draft.baseYield,
                  yieldUnit: draft.yieldUnit,
                  minimumBatchQuantity: draft.minimumBatchQuantity,
                  minimumBatchUnit: draft.minimumBatchUnit,
                  portionQuantity: draft.portionQuantity ?? undefined,
                  portionUnit: draft.portionUnit ?? undefined,
                  chefNotes: draft.chefNotes,
                  equipment: [],
                  items: draft.items.map((item) => ({
                    id: item.id,
                    kind: item.kind,
                    proposedName: item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                    preparationNote: item.preparationNote,
                  })),
                  steps: draft.steps.map((step) => ({
                    id: step.id,
                    instruction: step.instruction,
                  })),
                },
                inlineComponents: [],
              }}
              onImport={acceptAIRevision}
              successMessage="AI+ revision loaded into the editor."
              closeAfterImport
              disabled={busy}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-zinc-400">Recipe name</span>
            <input value={draft.name} onChange={(e) => setField("name", e.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Recipe type</span>
            <select value={draft.recipeType} onChange={(e) => setField("recipeType", e.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2">
              {["main","side","component","sauce","dressing","dessert","bread","other"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-zinc-400">Current version</span>
            <div className="border border-zinc-800 bg-black px-3 py-2 text-zinc-400">Approved</div>
          </div>

          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Yield type</span>
            <select value={draft.yieldKind} onChange={(e) => {
              const kind = e.target.value;
              setDraft((current) => ({ ...current, yieldKind: kind, yieldUnit: yieldUnits[kind]?.[0] ?? current.yieldUnit }));
            }} className="w-full border border-zinc-600 bg-black px-3 py-2">
              {["servings","liquid","solid","countable"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Base yield</span>
            <input type="number" step="any" value={draft.baseYield} onChange={(e) => setField("baseYield", Number(e.target.value))} className="w-full border border-zinc-600 bg-black px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Yield unit</span>
            <select value={draft.yieldUnit} onChange={(e) => setField("yieldUnit", e.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2">
              {(yieldUnits[draft.yieldKind] ?? allUnits).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-zinc-400">Minimum batch</span>
              <input type="number" step="any" value={draft.minimumBatchQuantity} onChange={(e) => setField("minimumBatchQuantity", Number(e.target.value))} className="w-full border border-zinc-600 bg-black px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-zinc-400">Unit</span>
              <select value={draft.minimumBatchUnit} onChange={(e) => setField("minimumBatchUnit", e.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2">
                {allUnits.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <div id="production-portion" className="scroll-mt-6 rounded border border-amber-900/70 bg-amber-950/10 p-3 md:col-span-2 xl:col-span-2">
            <div className="text-sm font-semibold text-amber-300">Production portion</div>
            <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
              <label className="text-sm">
                <span className="mb-1 block text-zinc-400">Quantity per portion</span>
                <input type="number" step="any" value={draft.portionQuantity ?? ""} onChange={(e) => setField("portionQuantity", e.target.value ? Number(e.target.value) : null)} placeholder="6" className="w-full border border-zinc-600 bg-black px-3 py-2" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-zinc-400">Unit</span>
                <select value={draft.portionUnit ?? ""} onChange={(e) => setField("portionUnit", e.target.value || null)} className="w-full border border-zinc-600 bg-black px-3 py-2">
                  <option value="">Not defined</option>
                  {["oz","lb","fl_oz","cup","quart","g","kg","each","serving"].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
          </div>

          <label className="text-sm md:col-span-2 xl:col-span-4">
            <span className="mb-1 block text-zinc-400">Chef notes</span>
            <textarea rows={3} value={draft.chefNotes} onChange={(e) => setField("chefNotes", e.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2" />
          </label>
        </div>
      </section>

      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <h2 className="text-lg font-semibold">Ingredients and components</h2>
        <div className="mt-3 space-y-2">
          {draft.items.map((item, index) => {
            const options = item.kind === "ingredient" ? draft.ingredientOptions : draft.componentOptions;
            return (
              <div key={item.id || index} className="grid gap-2 border border-zinc-800 p-2 lg:grid-cols-[9rem_1fr_7rem_7rem_1fr_auto]">
                <select value={item.kind} onChange={(e) => updateItem(index, { kind: e.target.value as "ingredient" | "recipe", sourceId: "" })} className="border border-zinc-700 bg-black px-2 py-2">
                  <option value="ingredient">Purchased</option>
                  <option value="recipe">Component</option>
                </select>
                <select value={item.sourceId} onChange={(e) => updateItem(index, { sourceId: e.target.value })} className="min-w-0 border border-zinc-700 bg-black px-2 py-2">
                  <option value="">Choose…</option>
                  {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
                <input type="number" step="any" value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} className="border border-zinc-700 bg-black px-2 py-2" />
                <select value={item.unit} onChange={(e) => updateItem(index, { unit: e.target.value })} className="border border-zinc-700 bg-black px-2 py-2">
                  {allUnits.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <input value={item.preparationNote} onChange={(e) => updateItem(index, { preparationNote: e.target.value })} placeholder="Preparation note" className="border border-zinc-700 bg-black px-2 py-2" />
                <button type="button" onClick={() => setDraft((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))} className="border border-red-900 px-3 text-red-300">Remove</button>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setDraft((current) => ({ ...current, items: [...current.items, { id: crypto.randomUUID(), kind: "ingredient", sourceId: "", name: "", quantity: 1, unit: "g", preparationNote: "" }] }))} className="border border-zinc-700 px-3 py-2 text-sm">Add purchased ingredient</button>
          <button type="button" onClick={() => setDraft((current) => ({ ...current, items: [...current.items, { id: crypto.randomUUID(), kind: "recipe", sourceId: "", name: "", quantity: 1, unit: "g", preparationNote: "" }] }))} className="border border-blue-800 px-3 py-2 text-sm text-blue-300">Add component</button>
        </div>
      </section>

      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <h2 className="text-lg font-semibold">Preparation steps</h2>
        <div className="mt-3 space-y-2">
          {draft.steps.map((step, index) => (
            <div key={step.id || index} className="grid gap-2 md:grid-cols-[auto_1fr_auto]">
              <span className="px-2 py-2 text-zinc-500">{index + 1}</span>
              <textarea rows={2} value={step.instruction} onChange={(e) => setDraft((current) => {
                const steps = [...current.steps];
                steps[index] = { ...steps[index], instruction: e.target.value };
                return { ...current, steps };
              })} className="border border-zinc-700 bg-black px-3 py-2" />
              <button type="button" onClick={() => setDraft((current) => ({ ...current, steps: current.steps.filter((_, i) => i !== index) }))} className="border border-red-900 px-3 text-red-300">Remove</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setDraft((current) => ({ ...current, steps: [...current.steps, { id: crypto.randomUUID(), instruction: "" }] }))} className="mt-3 border border-zinc-700 px-3 py-2 text-sm">Add step</button>
      </section>

      <div className="flex justify-end">
        <button type="button" disabled={busy} onClick={save} className="border border-emerald-600 px-5 py-2 font-semibold text-emerald-300 disabled:opacity-40">
          {busy ? "Saving…" : "Save new approved version"}
        </button>
      </div>
    </div>
  );
}
