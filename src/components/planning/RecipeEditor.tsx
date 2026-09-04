"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import SecretAIImportBox, { type SecretAIFormSchema } from "@/components/SecretAIImportBox/SecretAIImportBox";

import type {
  IngredientRecord,
  RecipeItemRecord,
  RecipeRecord,
  RecipeStepRecord,
} from "@/types/cookbook-data";

const unitLabels: Record<string, string> = {
  serving: "serving",
  each: "each",
  tsp: "tsp",
  tbsp: "tbsp",
  fl_oz: "fl oz",
  cup: "cup",
  quart: "quart",
  g: "g",
  kg: "kg",
};


const recipeImportSchema = {
  name: "Cookbook Recipe",
  description:
    "Create or improve this recipe. Return the complete recipe, including unchanged information. Keep the batch as small as practical. Purchased items are ingredients; preparations with their own recipe are components. Cups and quarts are liquid-only. For dry or solid items, use tsp or tbsp only below 2 tbsp, then use g or kg.",
  fields: {
    name: { type: "string", required: true, description: "Clear recipe name." },
    recipe_type: {
      type: "enum",
      required: true,
      values: ["main", "side", "component", "sauce", "dressing", "dessert", "bread", "other"],
    },
    yield_kind: {
      type: "enum",
      required: true,
      values: ["servings", "liquid", "solid", "countable"],
    },
    base_yield: {
      type: "number",
      required: true,
      description: "Amount produced by the written recipe.",
    },
    yield_unit: {
      type: "enum",
      required: true,
      values: ["serving", "each", "fl_oz", "cup", "quart", "g", "kg"],
    },
    minimum_batch: {
      type: "number",
      required: true,
      description: "Smallest practical batch.",
    },
    notes: { type: "string" },
    items: {
      type: "array",
      required: true,
      items: {
        type: "object",
        fields: {
          name: { type: "string", required: true },
          item_type: {
            type: "enum",
            required: true,
            values: ["ingredient", "component"],
          },
          measurement_kind: {
            type: "enum",
            required: true,
            values: ["liquid", "solid", "countable"],
          },
          quantity: { type: "number", required: true },
          unit: {
            type: "enum",
            required: true,
            values: ["serving", "each", "tsp", "tbsp", "fl_oz", "cup", "quart", "g", "kg"],
          },
          preparation_note: { type: "string" },
        },
      },
    },
    steps: {
      type: "array",
      required: true,
      items: {
        type: "object",
        fields: {
          instruction: { type: "string", required: true },
        },
      },
    },
  },
} satisfies SecretAIFormSchema;

type ImportedItem = {
  name: string;
  item_type: "ingredient" | "component";
  measurement_kind: "liquid" | "solid" | "countable";
  quantity: number;
  unit: string;
  preparation_note?: string;
};

type ImportedRecipe = {
  name: string;
  recipe_type: string;
  yield_kind: string;
  base_yield: number;
  yield_unit: string;
  minimum_batch: number;
  notes?: string;
  items: ImportedItem[];
  steps: Array<{ instruction: string }>;
};

function unitsFor(kind: string | null | undefined) {
  if (kind === "liquid") return ["tsp", "tbsp", "fl_oz", "cup", "quart"];
  if (kind === "solid") return ["tsp", "tbsp", "g", "kg"];
  if (kind === "countable") return ["each"];
  if (kind === "servings") return ["serving"];
  return ["each", "tsp", "tbsp", "fl_oz", "cup", "quart", "g", "kg", "serving"];
}

function yieldUnitsFor(kind: string | null | undefined) {
  if (kind === "liquid") return ["fl_oz", "cup", "quart"];
  if (kind === "solid") return ["g", "kg"];
  if (kind === "countable") return ["each"];
  if (kind === "servings") return ["serving"];
  return [];
}

export default function RecipeEditor({
  recipe,
  items,
  steps,
  ingredients,
  recipes,
}: {
  recipe: RecipeRecord;
  items: RecipeItemRecord[];
  steps: RecipeStepRecord[];
  ingredients: IngredientRecord[];
  recipes: RecipeRecord[];
}) {
  const router = useRouter();
  const [name, setName] = useState(recipe.name);
  const [recipeType, setRecipeType] = useState(recipe.recipeType);
  const [status, setStatus] = useState(recipe.status);
  const [yieldKind, setYieldKind] = useState(recipe.yieldKind ?? "");
  const [baseYield, setBaseYield] = useState(
    recipe.baseYield?.toString() ?? "",
  );
  const [yieldUnit, setYieldUnit] = useState(recipe.yieldUnit ?? "");
  const [minimumBatch, setMinimumBatch] = useState(
    recipe.minimumBatch?.toString() ?? "",
  );
  const [notes, setNotes] = useState(recipe.notes ?? "");
  const [itemType, setItemType] =
    useState<"ingredient" | "component">("ingredient");
  const [sourceId, setSourceId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("g");
  const [preparationNote, setPreparationNote] = useState("");
  const [instruction, setInstruction] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickKind, setQuickKind] =
    useState<IngredientRecord["measurementKind"]>("solid");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQuantity, setEditItemQuantity] = useState("");
  const [editItemUnit, setEditItemUnit] = useState("");
  const [editItemNote, setEditItemNote] = useState("");

  const components = recipes.filter(
    (candidate) =>
      candidate.recipeType === "component" && candidate.id !== recipe.id,
  );
  const sources = itemType === "ingredient" ? ingredients : components;
  const selectedIngredient =
    itemType === "ingredient"
      ? ingredients.find((ingredient) => ingredient.id === sourceId)
      : undefined;
  const availableUnits = useMemo(
    () =>
      itemType === "component"
        ? unitsFor(undefined)
        : unitsFor(selectedIngredient?.measurementKind),
    [itemType, selectedIngredient?.measurementKind],
  );

  function begin() {
    setBusy(true);
    setMessage("");
    setError("");
  }

  function finish(errorValue?: unknown) {
    if (errorValue) {
      setError(
        errorValue instanceof Error ? errorValue.message : "The action failed.",
      );
    }
    setBusy(false);
  }

  async function readResponse(response: Response) {
    const result = (await response.json()) as { error?: string; id?: string };
    if (!response.ok) throw new Error(result.error || "The action failed.");
    return result;
  }

  async function saveRecipe() {
    begin();
    try {
      await readResponse(
        await fetch("/api/recipes/" + recipe.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            recipeType,
            status,
            yieldKind: yieldKind || null,
            baseYield: baseYield ? Number(baseYield) : null,
            yieldUnit: yieldUnit || null,
            minimumBatch: minimumBatch ? Number(minimumBatch) : null,
            notes,
          }),
        }),
      );
      setMessage("Recipe details saved.");
      router.refresh();
      finish();
    } catch (saveError) {
      finish(saveError);
    }
  }

  async function addItem() {
    if (!sourceId || !quantity || !unit) return;
    begin();
    try {
      await readResponse(
        await fetch("/api/recipes/" + recipe.id + "/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemType,
            sourceId,
            quantity: Number(quantity),
            unit,
            preparationNote,
          }),
        }),
      );
      setSourceId("");
      setQuantity("");
      setPreparationNote("");
      setMessage("Recipe item added.");
      router.refresh();
      finish();
    } catch (itemError) {
      finish(itemError);
    }
  }

  async function addStep() {
    if (!instruction.trim()) return;
    begin();
    try {
      await readResponse(
        await fetch("/api/recipes/" + recipe.id + "/steps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction }),
        }),
      );
      setInstruction("");
      setMessage("Preparation step added.");
      router.refresh();
      finish();
    } catch (stepError) {
      finish(stepError);
    }
  }

  async function remove(path: string) {
    begin();
    try {
      await readResponse(await fetch(path, { method: "DELETE" }));
      setMessage("Removed.");
      router.refresh();
      finish();
    } catch (removeError) {
      finish(removeError);
    }
  }


  function beginItemEdit(item: RecipeItemRecord) {
    setEditingItemId(item.id);
    setEditItemName(item.displayName);
    setEditItemQuantity(item.quantity.toString());
    setEditItemUnit(item.unit);
    setEditItemNote(item.preparationNote ?? "");
    setMessage("");
    setError("");
  }

  async function saveItemEdit(item: RecipeItemRecord) {
    if (!editItemName.trim() || !editItemQuantity || !editItemUnit) return;
    begin();
    try {
      await readResponse(
        await fetch("/api/recipe-items/" + item.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editItemName,
            quantity: Number(editItemQuantity),
            unit: editItemUnit,
            preparationNote: editItemNote,
          }),
        }),
      );
      setEditingItemId(null);
      setMessage("Recipe line saved.");
      router.refresh();
      finish();
    } catch (saveError) {
      finish(saveError);
    }
  }

  async function createInline() {
    if (!quickName.trim()) return;
    begin();
    try {
      const response =
        itemType === "ingredient"
          ? await fetch("/api/ingredients", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: quickName,
                measurementKind: quickKind,
              }),
            })
          : await fetch("/api/recipes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: quickName,
                recipeType: "component",
              }),
            });
      const result = await readResponse(response);
      setQuickName("");
      setMessage(
        itemType === "ingredient"
          ? "Purchased ingredient created."
          : "Draft component created and added to Reconciliation.",
      );
      if (result.id) setSourceId(result.id);
      router.refresh();
      finish();
    } catch (creationError) {
      finish(creationError);
    }
  }


  async function acceptAIImport(values: Record<string, unknown>) {
    const importedRecipe = values as unknown as ImportedRecipe;
    setName(importedRecipe.name);
    setRecipeType(importedRecipe.recipe_type);
    setStatus("draft");
    setYieldKind(importedRecipe.yield_kind);
    setBaseYield(importedRecipe.base_yield.toString());
    setYieldUnit(importedRecipe.yield_unit);
    setMinimumBatch(importedRecipe.minimum_batch.toString());
    setNotes(importedRecipe.notes ?? "");
    begin();
    try {
      await readResponse(
        await fetch("/api/recipes/" + recipe.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: importedRecipe.name,
            recipeType: importedRecipe.recipe_type,
            status: "draft",
            yieldKind: importedRecipe.yield_kind,
            baseYield: Number(importedRecipe.base_yield),
            yieldUnit: importedRecipe.yield_unit,
            minimumBatch: Number(importedRecipe.minimum_batch),
            notes: importedRecipe.notes ?? "",
          }),
        }),
      );

      for (const existing of items) {
        await readResponse(await fetch("/api/recipe-items/" + existing.id, { method: "DELETE" }));
      }
      for (const existing of steps) {
        await readResponse(await fetch("/api/recipe-steps/" + existing.id, { method: "DELETE" }));
      }

      for (const importedItem of importedRecipe.items ?? []) {
        let sourceIdValue = "";
        if (importedItem.item_type === "ingredient") {
          const existing = ingredients.find(
            (entry) => entry.name.toLowerCase() === importedItem.name.trim().toLowerCase(),
          );
          if (existing) {
            sourceIdValue = existing.id;
          } else {
            const created = await readResponse(
              await fetch("/api/ingredients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: importedItem.name,
                  measurementKind: importedItem.measurement_kind,
                }),
              }),
            );
            sourceIdValue = created.id ?? "";
          }
        } else {
          const existing = components.find(
            (entry) => entry.name.toLowerCase() === importedItem.name.trim().toLowerCase(),
          );
          if (existing) {
            sourceIdValue = existing.id;
          } else {
            const created = await readResponse(
              await fetch("/api/recipes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: importedItem.name, recipeType: "component" }),
              }),
            );
            sourceIdValue = created.id ?? "";
          }
        }
        if (!sourceIdValue) throw new Error("Could not create " + importedItem.name + ".");
        await readResponse(
          await fetch("/api/recipes/" + recipe.id + "/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemType: importedItem.item_type,
              sourceId: sourceIdValue,
              quantity: Number(importedItem.quantity),
              unit: importedItem.unit,
              preparationNote: importedItem.preparation_note ?? "",
            }),
          }),
        );
      }

      for (const importedStep of importedRecipe.steps ?? []) {
        await readResponse(
          await fetch("/api/recipes/" + recipe.id + "/steps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instruction: importedStep.instruction }),
          }),
        );
      }

      setStatus("draft");
      setMessage("Recipe imported and saved as a draft.");
      router.refresh();
      finish();
    } catch (importError) {
      finish(importError);
    }
  }

  function changeYieldKind(nextKind: string) {
    setYieldKind(nextKind);
    const nextUnits = yieldUnitsFor(nextKind);
    setYieldUnit(nextUnits[0] ?? "");
  }

  function changeSource(nextId: string) {
    setSourceId(nextId);
    const ingredient = ingredients.find((entry) => entry.id === nextId);
    const component = components.find((entry) => entry.id === nextId);
    const nextUnits =
      component ? unitsFor(undefined) : unitsFor(ingredient?.measurementKind);
    setUnit(nextUnits[0] ?? "g");
  }

  return (
    <div className="mt-6 space-y-6">

      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">Recipe definition</h2>
          <div className="ml-auto flex max-w-full flex-wrap items-start justify-end gap-3">
            <span
              className={
                status === "complete" ? "pt-1 text-emerald-400" : "pt-1 text-amber-300"
              }
            >
              {status === "complete" ? "Complete" : "Draft"}
            </span>
            <SecretAIImportBox
              formSchema={recipeImportSchema}
              currentValues={{
                name,
                recipe_type: recipeType,
                yield_kind: yieldKind,
                base_yield: baseYield ? Number(baseYield) : null,
                yield_unit: yieldUnit,
                minimum_batch: minimumBatch ? Number(minimumBatch) : null,
                notes,
                items: items.map((item) => ({
                  name: item.displayName,
                  item_type: item.itemType,
                  quantity: item.quantity,
                  unit: item.unit,
                  preparation_note: item.preparationNote ?? "",
                })),
                steps: steps.map((step) => ({ instruction: step.instruction })),
              }}
              onImport={acceptAIImport}
              successMessage="Recipe imported and saved."
              closeAfterImport
              disabled={busy}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-zinc-400">Recipe name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Recipe type</span>
            <select value={recipeType} onChange={(event) => setRecipeType(event.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2">
              {["main", "side", "component", "sauce", "dressing", "dessert", "bread", "other"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as RecipeRecord["status"])} className="w-full border border-zinc-600 bg-black px-3 py-2">
              <option value="draft">Draft</option>
              <option value="complete">Complete</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Yield type</span>
            <select value={yieldKind} onChange={(event) => changeYieldKind(event.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2">
              <option value="">Not defined</option>
              <option value="servings">Servings</option>
              <option value="liquid">Liquid</option>
              <option value="solid">Solid</option>
              <option value="countable">Countable</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Base yield</span>
            <input type="number" min="0" step="any" value={baseYield} onChange={(event) => setBaseYield(event.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Yield unit</span>
            <select value={yieldUnit} onChange={(event) => setYieldUnit(event.target.value)} disabled={!yieldKind} className="w-full border border-zinc-600 bg-black px-3 py-2 disabled:opacity-40">
              {yieldUnitsFor(yieldKind).map((value) => <option key={value} value={value}>{unitLabels[value]}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-400">Minimum batch</span>
            <input type="number" min="0" step="any" value={minimumBatch} onChange={(event) => setMinimumBatch(event.target.value)} className="w-full border border-zinc-600 bg-black px-3 py-2" />
          </label>
        </div>

        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-zinc-400">Chef notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full border border-zinc-600 bg-black px-3 py-2" />
        </label>
        <button type="button" disabled={busy} onClick={saveRecipe} className="mt-4 border border-blue-500 px-4 py-2 disabled:opacity-40">Save Recipe Details</button>
      </section>

      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <h2 className="text-lg font-semibold">Ingredients and components</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr_7rem_8rem_1fr_auto]">
          <div className="flex">
            {(["ingredient", "component"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setItemType(value);
                  setSourceId("");
                  setUnit(value === "component" ? "g" : unit);
                }}
                className={
                  "border px-3 py-2 " +
                  (itemType === value
                    ? "border-blue-500 bg-blue-950 text-blue-100"
                    : "border-zinc-600 bg-black text-zinc-300")
                }
              >
                {value === "ingredient" ? "Purchased" : "Component"}
              </button>
            ))}
          </div>
          <select value={sourceId} onChange={(event) => changeSource(event.target.value)} className="border border-zinc-600 bg-black px-3 py-2">
            <option value="">Choose {itemType}</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
          <input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Qty" className="border border-zinc-600 bg-black px-3 py-2" />
          <select value={unit} onChange={(event) => setUnit(event.target.value)} className="border border-zinc-600 bg-black px-3 py-2">
            {availableUnits.map((value) => <option key={value} value={value}>{unitLabels[value]}</option>)}
          </select>
          <input value={preparationNote} onChange={(event) => setPreparationNote(event.target.value)} placeholder="Preparation note" className="border border-zinc-600 bg-black px-3 py-2" />
          <button type="button" disabled={busy || !sourceId || !quantity} onClick={addItem} className="border border-blue-500 px-3 py-2 disabled:opacity-40">Add</button>
        </div>

        <div className="mt-5 border border-zinc-800">
          {items.length === 0 ? <p className="p-3 text-sm text-zinc-400">No recipe items yet.</p> : items.map((item) => {
            const sourceKind =
              item.itemType === "ingredient"
                ? ingredients.find((entry) => entry.id === item.ingredientId)?.measurementKind
                : undefined;
            const rowUnits = unitsFor(sourceKind);
            return editingItemId === item.id ? (
              <div key={item.id} className="grid gap-2 border-b border-zinc-800 px-3 py-2 last:border-b-0 md:grid-cols-[auto_7rem_8rem_1fr_1.5fr_auto_auto]">
                <button type="button" title="Cancel line edit" onClick={() => setEditingItemId(null)} className="border border-zinc-600 px-2 py-1">✎</button>
                <input type="number" min="0" step="any" value={editItemQuantity} onChange={(event) => setEditItemQuantity(event.target.value)} className="min-w-0 border border-zinc-600 bg-black px-2 py-1" />
                <select value={editItemUnit} onChange={(event) => setEditItemUnit(event.target.value)} className="min-w-0 border border-zinc-600 bg-black px-2 py-1">
                  {rowUnits.map((value) => <option key={value} value={value}>{unitLabels[value] ?? value}</option>)}
                </select>
                <input value={editItemName} onChange={(event) => setEditItemName(event.target.value)} className="min-w-0 border border-zinc-600 bg-black px-2 py-1" />
                <input value={editItemNote} onChange={(event) => setEditItemNote(event.target.value)} placeholder="Preparation note" className="min-w-0 border border-zinc-600 bg-black px-2 py-1" />
                <button type="button" disabled={busy || !editItemName.trim() || !editItemQuantity} onClick={() => saveItemEdit(item)} className="border border-blue-600 px-3 py-1 disabled:opacity-40">Save</button>
                <button type="button" onClick={() => setEditingItemId(null)} className="border border-zinc-600 px-3 py-1">Cancel</button>
              </div>
            ) : (
              <div key={item.id} className="flex items-center gap-3 border-b border-zinc-800 px-3 py-2 last:border-b-0">
                <button type="button" title="Edit this recipe line" onClick={() => beginItemEdit(item)} className="border border-zinc-600 px-2 py-1">✎</button>
                <span className="w-20 text-right">{item.quantity} {unitLabels[item.unit] ?? item.unit}</span>
                <span className="flex-1">{item.displayName}{item.preparationNote ? <span className="ml-2 text-zinc-400">— {item.preparationNote}</span> : null}</span>
                <span className="text-xs capitalize text-zinc-500">{item.itemType}</span>
                {item.itemType === "component" && item.componentRecipeId ? (
                  <Link
                    href={"/planning/recipes/" + item.componentRecipeId}
                    className="border border-blue-700 px-2 py-1 text-blue-300"
                  >
                    Open Recipe
                  </Link>
                ) : null}
                <button type="button" onClick={() => remove("/api/recipe-items/" + item.id)} className="border border-red-800 px-2 py-1 text-red-300">Remove</button>
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <h3 className="font-semibold">Create missing {itemType}</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <input value={quickName} onChange={(event) => setQuickName(event.target.value)} placeholder={itemType === "ingredient" ? "New purchased ingredient" : "New component"} className="border border-zinc-600 bg-black px-3 py-2" />
            {itemType === "ingredient" ? (
              <select value={quickKind} onChange={(event) => setQuickKind(event.target.value as IngredientRecord["measurementKind"])} className="border border-zinc-600 bg-black px-3 py-2">
                <option value="solid">Solid</option>
                <option value="liquid">Liquid</option>
                <option value="countable">Countable</option>
              </select>
            ) : <span />}
            <button type="button" disabled={busy || !quickName.trim()} onClick={createInline} className="border border-blue-500 px-3 py-2 disabled:opacity-40">Create</button>
          </div>
        </div>
      </section>

      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <h2 className="text-lg font-semibold">Preparation steps</h2>
        <div className="mt-4 flex gap-3">
          <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={2} placeholder="Describe the next preparation step" className="min-w-0 flex-1 border border-zinc-600 bg-black px-3 py-2" />
          <button type="button" disabled={busy || !instruction.trim()} onClick={addStep} className="self-end border border-blue-500 px-4 py-2 disabled:opacity-40">Add Step</button>
        </div>
        <ol className="mt-5 space-y-2">
          {steps.map((step) => (
            <li key={step.id} className="flex gap-3 border border-zinc-800 p-3">
              <span className="font-bold">{step.stepNumber}.</span>
              <span className="flex-1">{step.instruction}</span>
              <button type="button" onClick={() => remove("/api/recipe-steps/" + step.id)} className="border border-red-800 px-2 py-1 text-red-300">Remove</button>
            </li>
          ))}
        </ol>
      </section>

      {message && <p className="border border-emerald-700 p-3 text-emerald-300">{message}</p>}
      {error && <p className="border border-red-700 p-3 text-red-300">{error}</p>}
    </div>
  );
}
