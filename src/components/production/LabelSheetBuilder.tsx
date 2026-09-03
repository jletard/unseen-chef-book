"use client";

import { useMemo, useState } from "react";
import type { RecipeLabel } from "@/lib/labeling-types";

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
  const [ingredientOrderConfirmed, setIngredientOrderConfirmed] = useState(false);
  const [nutritionExemptionConfirmed, setNutritionExemptionConfirmed] = useState(false);
  const recipe = recipes.find((item) => item.recipeId === recipeId);
  const useByDate = useMemo(() => {
    const date = new Date(`${preparedDate}T12:00:00`);
    date.setDate(date.getDate() + Math.max(shelfLifeDays - 1, 0));
    return isoDate(date);
  }, [preparedDate, shelfLifeDays]);
  const netDeclaration = netQuantityDeclaration(netQuantity, netUnit);
  const printable = Boolean(
    recipe &&
    productName.trim() &&
    preparedDate &&
    netDeclaration &&
    ingredientOrderConfirmed &&
    nutritionExemptionConfirmed &&
    recipe.incompleteIngredients.length === 0,
  );

  function chooseRecipe(id: string) {
    const selected = recipes.find((item) => item.recipeId === id);
    setRecipeId(id);
    setProductName(selected?.name ?? "");
    setIngredientOrderConfirmed(false);
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

        {recipe?.incompleteIngredients.length ? (
          <div className="mt-4 border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">
            Cannot print a compliance label yet. Review: {recipe.incompleteIngredients.join(" · ")}
          </div>
        ) : null}
        <button type="button" disabled={!printable} onClick={() => window.print()} className="mt-4 border border-emerald-600 px-5 py-2 font-semibold text-emerald-300 disabled:opacity-40">Print Avery 6464 sheets</button>
      </section>

      {recipe && (
        <div className="label-sheet mt-6">
          {Array.from({ length: Math.max(copies, 0) }, (_, index) => (
            <article className="food-label" key={index}>
              <header>
                <div className="food-label-brand">THE UNSEEN CHEF</div>
                <h2>{productName || recipe.name}</h2>
              </header>
              <p><strong>Ingredients:</strong> {recipe.ingredientStatement || "Ingredient data incomplete"}</p>
              {recipe.allergens.length > 0 && <p className="food-label-allergens"><strong>CONTAINS:</strong> {recipe.allergens.join(", ")}</p>}
              <div className="food-label-dates">
                <span><strong>Prepared:</strong> {preparedDate}</span>
                <span><strong>Use by:</strong> {useByDate}</span>
              </div>
              <p><strong>{netUnit === "fl oz" ? "Net Contents" : "Net Wt."}</strong> {netDeclaration || "_____"}</p>
              <p className="food-label-storage">KEEP REFRIGERATED AT 41°F OR BELOW</p>
              <footer>The Unseen Chef · {businessAddress}</footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
