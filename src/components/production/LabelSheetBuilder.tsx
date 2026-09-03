"use client";

import { useMemo, useState } from "react";
import type { RecipeLabel } from "@/lib/labeling-types";

type LabelJob = {
  id: string;
  recipeId: string;
  productName: string;
  netDeclaration: string;
  netUnit: string;
  preparedDate: string;
  useByDate: string;
  copies: number;
  ingredientStatement: string;
  allergens: string[];
};

type SideSelection = { id: string; label: string; recipeId: string; variable: boolean };

function initialSideSelections(recipe?: RecipeLabel): SideSelection[] {
  return (recipe?.sideSelections ?? []).map((side, index) => ({
    id: `default-side-${index}`,
    label: side.label,
    recipeId: side.recipeId ?? "",
    variable: Boolean(side.variable),
  }));
}

const businessAddress = "4959 Pan American Freeway NE Suite A, Albuquerque, NM 87109";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function roundedMetric(value: number) {
  return value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
}

function roundedCustomary(value: number) {
  return Math.round(value * 100) / 100;
}

function netQuantityDeclaration(quantity: string, unit: string) {
  const value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (unit === "oz") return `${roundedCustomary(value)} oz (${roundedMetric(value * 28.349523125)} g)`;
  if (unit === "lb") return `${roundedCustomary(value)} lb (${roundedMetric(value * 453.59237)} g)`;
  if (unit === "g") return `${roundedCustomary(value / 28.349523125)} oz (${roundedMetric(value)} g)`;
  if (unit === "fl oz") return `${roundedCustomary(value)} fl oz (${roundedMetric(value * 29.5735295625)} mL)`;
  return "";
}

export default function LabelSheetBuilder({ recipes }: { recipes: RecipeLabel[] }) {
  const [recipeId, setRecipeId] = useState(recipes[0]?.recipeId ?? "");
  const [productName, setProductName] = useState(recipes[0]?.name ?? "");
  const [netQuantity, setNetQuantity] = useState("");
  const [netUnit, setNetUnit] = useState("oz");
  const [preparedDate, setPreparedDate] = useState(isoDate(new Date()));
  const [shelfLifeDays, setShelfLifeDays] = useState(7);
  const [copies, setCopies] = useState(6);
  const [labelJobs, setLabelJobs] = useState<LabelJob[]>([]);
  const [variableSideIngredients, setVariableSideIngredients] = useState<Record<string, string>>({});
  const [selectedSides, setSelectedSides] = useState<SideSelection[]>(() => initialSideSelections(recipes[0]));
  const [ingredientOrderConfirmed, setIngredientOrderConfirmed] = useState(false);
  const [nutritionExemptionConfirmed, setNutritionExemptionConfirmed] = useState(false);
  const recipe = recipes.find((item) => item.recipeId === recipeId);
  const useByDate = useMemo(() => {
    const date = new Date(`${preparedDate}T12:00:00`);
    date.setDate(date.getDate() + Math.max(shelfLifeDays - 1, 0));
    return isoDate(date);
  }, [preparedDate, shelfLifeDays]);
  const netDeclaration = netQuantityDeclaration(netQuantity, netUnit);
  const sideRecipes = recipes.filter((item) => item.recipeCategory === "side" && !item.recipeId.startsWith("menu:"));
  const selectedSideRecipeRecords = selectedSides
    .filter((side) => !side.variable && side.recipeId)
    .map((side) => recipes.find((item) => item.recipeId === side.recipeId))
    .filter((side): side is RecipeLabel => Boolean(side));
  const selectableSidesComplete = selectedSides.every((side) =>
    side.variable ? variableSideIngredients[side.id]?.trim() : side.recipeId,
  );
  const selectedSideIncompleteIngredients = selectedSideRecipeRecords.flatMap((side) => side.incompleteIngredients);
  const currentLabelValid = Boolean(
    recipe &&
    productName.trim() &&
    preparedDate &&
    netDeclaration &&
    ingredientOrderConfirmed &&
    nutritionExemptionConfirmed &&
    selectableSidesComplete &&
    selectedSideIncompleteIngredients.length === 0 &&
    recipe.incompleteIngredients.length === 0,
  );
  const printable = labelJobs.length > 0;

  function chooseRecipe(id: string) {
    const selected = recipes.find((item) => item.recipeId === id);
    setRecipeId(id);
    setProductName(selected?.name ?? "");
    setVariableSideIngredients({});
    setSelectedSides(initialSideSelections(selected));
    setIngredientOrderConfirmed(false);
  }

  function addToSheet() {
    if (!recipe || !currentLabelValid) return;
    const variableStatements = selectedSides.filter((side) => side.variable).map(
      (side) => `${side.label}: ${variableSideIngredients[side.id].trim()}`,
    );
    const selectedStatements = selectedSideRecipeRecords.map((side) =>
      side.ingredientStatement ? `${side.name}: ${side.ingredientStatement}` : side.name,
    );
    const selectedAllergens = new Set(recipe.allergens);
    selectedSideRecipeRecords.forEach((side) => side.allergens.forEach((allergen) => selectedAllergens.add(allergen)));
    setLabelJobs((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        recipeId: recipe.recipeId,
        productName: productName.trim(),
        netDeclaration,
        netUnit,
        preparedDate,
        useByDate,
        copies: Math.max(1, Math.floor(copies)),
        ingredientStatement: [recipe.ingredientStatement, ...selectedStatements, ...variableStatements].filter(Boolean).join("; "),
        allergens: Array.from(selectedAllergens).sort(),
      },
    ]);
  }

  return (
    <div className="mt-6">
      <section className="label-controls border border-zinc-800 bg-zinc-950 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">Approved recipe
            <select value={recipeId} onChange={(event) => chooseRecipe(event.target.value)} className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2">
              {recipes.map((item) => <option key={item.recipeId} value={item.recipeId}>{item.name}</option>)}
            </select>
          </label>
          {recipe?.defaultSides?.length ? (
            <div className="text-sm md:col-span-2 xl:col-span-4">
              <span className="text-zinc-400">Saved sides (editable below):</span>{" "}
              <strong>{recipe.defaultSides.join(" · ")}</strong>
            </div>
          ) : null}
          {selectedSides.map((side) => (
            <div key={side.id} className="grid gap-2 md:col-span-2 md:grid-cols-[1fr_auto] xl:col-span-4">
              {side.variable ? (
                <label className="text-sm">Ingredients used in {side.label} this batch
                  <input value={variableSideIngredients[side.id] ?? ""} onChange={(event) => setVariableSideIngredients((current) => ({ ...current, [side.id]: event.target.value }))} placeholder="e.g. broccoli, carrots, zucchini, olive oil, kosher salt, black pepper" className="mt-1 block w-full border border-amber-700 bg-black px-3 py-2" />
                </label>
              ) : (
                <label className="text-sm">Side {side.recipeId ? "" : `(choose replacement for ${side.label})`}
                  <select value={side.recipeId} onChange={(event) => setSelectedSides((current) => current.map((item) => item.id === side.id ? { ...item, recipeId: event.target.value } : item))} className="mt-1 block w-full border border-amber-700 bg-black px-3 py-2">
                    <option value="">Select an approved side</option>
                    {sideRecipes.map((option) => <option key={option.recipeId} value={option.recipeId}>{option.name}</option>)}
                  </select>
                </label>
              )}
              <button type="button" onClick={() => setSelectedSides((current) => current.filter((item) => item.id !== side.id))} className="self-end border border-red-800 px-4 py-2 text-red-300">Remove side</button>
            </div>
          ))}
          {recipe?.recipeId.startsWith("menu:") ? (
            <button type="button" onClick={() => setSelectedSides((current) => [...current, { id: crypto.randomUUID(), label: "Additional side", recipeId: "", variable: false }])} className="w-fit border border-sky-700 px-4 py-2 text-sm text-sky-300 md:col-span-2 xl:col-span-4">Add side</button>
          ) : null}
          <label className="text-sm">Printed product name
            <input value={productName} onChange={(event) => setProductName(event.target.value)} className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2" />
          </label>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <label className="text-sm">Net quantity
              <input value={netQuantity} onChange={(event) => setNetQuantity(event.target.value)} inputMode="decimal" className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2" />
            </label>
            <label className="text-sm">Unit
              <select value={netUnit} onChange={(event) => setNetUnit(event.target.value)} className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2"><option>oz</option><option>lb</option><option>g</option><option>fl oz</option></select>
            </label>
          </div>
          <label className="text-sm">Number of labels
            <input type="number" min={1} max={120} value={copies} onChange={(event) => setCopies(Number(event.target.value))} className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2" />
          </label>
          <label className="text-sm">Prepared date
            <input type="date" value={preparedDate} onChange={(event) => setPreparedDate(event.target.value)} className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2" />
          </label>
          <label className="text-sm">Shelf life including prep day
            <input type="number" min={1} max={7} value={shelfLifeDays} onChange={(event) => setShelfLifeDays(Number(event.target.value))} className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2" />
          </label>
        </div>

        <div className="mt-4 grid gap-2 border border-zinc-800 p-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={ingredientOrderConfirmed} onChange={(event) => setIngredientOrderConfirmed(event.target.checked)} className="mt-1 size-4" />
            <span>I verified that ingredients and component subingredients appear in descending order by weight.</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={nutritionExemptionConfirmed} onChange={(event) => setNutritionExemptionConfirmed(event.target.checked)} className="mt-1 size-4" />
            <span>This food is prepared on-site, sold only by this establishment, and carries no nutrition or health claim; the retail-establishment Nutrition Facts exemption applies.</span>
          </label>
          {netDeclaration && <div className="text-zinc-400">Printed net quantity: <strong className="text-white">{netDeclaration}</strong></div>}
        </div>

        {(recipe?.incompleteIngredients.length || selectedSideIncompleteIngredients.length) ? (
          <div className="mt-4 border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">
            Cannot print a compliance label yet. Review: {[...(recipe?.incompleteIngredients ?? []), ...selectedSideIncompleteIngredients].join(" · ")}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={!currentLabelValid} onClick={addToSheet} className="border border-sky-600 px-5 py-2 font-semibold text-sky-300 disabled:opacity-40">Add labels to sheet</button>
          <button type="button" disabled={!printable} onClick={() => window.print()} className="border border-emerald-600 px-5 py-2 font-semibold text-emerald-300 disabled:opacity-40">Print mixed Avery 6464 sheet</button>
        </div>

        <div className="mt-4 border border-zinc-800 p-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Labels on this print run</h2>
            <span className="text-sm text-zinc-400">{labelJobs.reduce((total, job) => total + job.copies, 0)} labels</span>
          </div>
          {labelJobs.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">Choose a recipe and quantity, then add it to the sheet. Repeat for each product.</p>
          ) : (
            <div className="mt-2 grid gap-2">
              {labelJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between gap-3 border border-zinc-800 px-3 py-2 text-sm">
                  <span><strong>{job.copies}×</strong> {job.productName} · {job.netDeclaration}</span>
                  <button type="button" onClick={() => setLabelJobs((current) => current.filter((item) => item.id !== job.id))} className="border border-red-800 px-3 py-1 text-red-300">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {labelJobs.length > 0 && (
        <div className="label-sheet mt-6">
          {labelJobs.flatMap((job) => {
            const jobRecipe = recipes.find((item) => item.recipeId === job.recipeId);
            if (!jobRecipe) return [];
            return Array.from({ length: job.copies }, (_, index) => (
            <article className="food-label" key={`${job.id}-${index}`}>
              <header className="food-label-header">
                {/* This is the same production logo asset used by the admin label report. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://order.theunseenchef.com/images/branding/unseen-chef-logo-main.png"
                  alt="The Unseen Chef"
                  className="food-label-logo"
                />
                <h2>{job.productName || jobRecipe.name}</h2>
              </header>
              <p><strong>Ingredients:</strong> {job.ingredientStatement || "Ingredient data incomplete"}</p>
              {job.allergens.length > 0 && <p className="food-label-allergens"><strong>CONTAINS:</strong> {job.allergens.join(", ")}</p>}
              <div className="food-label-dates">
                <span><strong>Prepared:</strong> {job.preparedDate}</span>
                <span><strong>Use by:</strong> {job.useByDate}</span>
              </div>
              <p><strong>{job.netUnit === "fl oz" ? "Net Contents" : "Net Wt."}</strong> {job.netDeclaration}</p>
              <p className="food-label-storage">KEEP REFRIGERATED AT 40°F OR BELOW</p>
              <footer>The Unseen Chef · {businessAddress}</footer>
            </article>
          ));
          })}
        </div>
      )}
    </div>
  );
}
