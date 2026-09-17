import { getIngredientNutrition, getRecipeNutrition } from "@/lib/nutrition-data";

function round(value: number | null, digits = 0) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function confidenceClass(confidence: string | null) {
  if (confidence === "verified" || confidence === "high") return "text-emerald-400";
  if (confidence === "medium") return "text-amber-300";
  return "text-zinc-400";
}

export default async function NutritionPage() {
  const [recipes, ingredients] = await Promise.all([
    getRecipeNutrition(),
    getIngredientNutrition(),
  ]);

  const complete = recipes.filter((recipe) => recipe.nutritionComplete).length;
  const incomplete = recipes.length - complete;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Nutrition</h1>
          <p className="mt-2 max-w-4xl text-sm text-zinc-400">
            Estimated nutrition from approved recipe versions and ingredient nutrition profiles. Recipe values are shown per yield unit; normal meal recipes are therefore per serving.
          </p>
        </div>
        <div className="text-right text-sm text-zinc-400">
          <div><span className="font-semibold text-emerald-400">{complete}</span> complete</div>
          {incomplete > 0 && <div><span className="font-semibold text-amber-300">{incomplete}</span> incomplete</div>}
        </div>
      </div>

      <section className="mt-6 border border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="font-semibold">Approved recipe nutrition</h2>
          <p className="mt-1 text-xs text-zinc-500">Estimated values per recipe yield unit. Incomplete calculations are flagged instead of silently showing partial numbers.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-black/40 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Recipe</th>
                <th className="px-3 py-2">Basis</th>
                <th className="px-3 py-2 text-right">Calories</th>
                <th className="px-3 py-2 text-right">Protein</th>
                <th className="px-3 py-2 text-right">Carbs</th>
                <th className="px-3 py-2 text-right">Fat</th>
                <th className="px-3 py-2 text-right">Fiber</th>
                <th className="px-3 py-2 text-right">Sodium</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((recipe) => (
                <tr key={recipe.recipeId} className="border-t border-zinc-900">
                  <td className="px-3 py-2 font-medium">{recipe.recipeName}</td>
                  <td className="px-3 py-2 text-zinc-500">1 {recipe.yieldUnit}</td>
                  <td className="px-3 py-2 text-right">{recipe.nutritionComplete ? round(recipe.caloriesPerServing) : "—"}</td>
                  <td className="px-3 py-2 text-right">{recipe.nutritionComplete ? `${round(recipe.proteinPerServing, 1)} g` : "—"}</td>
                  <td className="px-3 py-2 text-right">{recipe.nutritionComplete ? `${round(recipe.carbsPerServing, 1)} g` : "—"}</td>
                  <td className="px-3 py-2 text-right">{recipe.nutritionComplete ? `${round(recipe.fatPerServing, 1)} g` : "—"}</td>
                  <td className="px-3 py-2 text-right">{recipe.nutritionComplete ? `${round(recipe.fiberPerServing, 1)} g` : "—"}</td>
                  <td className="px-3 py-2 text-right">{recipe.nutritionComplete ? `${round(recipe.sodiumPerServing)} mg` : "—"}</td>
                  <td className={recipe.nutritionComplete ? "px-3 py-2 text-emerald-400" : "px-3 py-2 text-amber-300"}>
                    {recipe.nutritionComplete ? "Estimated" : `Incomplete (${recipe.nutritionIssueCount})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 border border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="font-semibold">Ingredient nutrition sources</h2>
          <p className="mt-1 text-xs text-zinc-500">Primary profile, provenance, confidence, and inherited nutrition source for purchased ingredients.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-black/40 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Ingredient</th>
                <th className="px-3 py-2">Nutrition source</th>
                <th className="px-3 py-2">Basis</th>
                <th className="px-3 py-2 text-right">Calories</th>
                <th className="px-3 py-2 text-right">Protein</th>
                <th className="px-3 py-2 text-right">Carbs</th>
                <th className="px-3 py-2 text-right">Fat</th>
                <th className="px-3 py-2 text-right">Sodium</th>
                <th className="px-3 py-2">Provenance</th>
                <th className="px-3 py-2">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ingredient) => (
                <tr key={ingredient.ingredientId} className="border-t border-zinc-900 align-top">
                  <td className="px-3 py-2 font-medium">{ingredient.ingredientName}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {ingredient.inheritsNutrition ? ingredient.sourceIngredientName : "Direct profile"}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {ingredient.basisQuantity === null ? "—" : `${ingredient.basisQuantity} ${ingredient.basisUnit ?? ""}`}
                  </td>
                  <td className="px-3 py-2 text-right">{round(ingredient.caloriesKcal)}</td>
                  <td className="px-3 py-2 text-right">{ingredient.proteinG === null ? "—" : `${round(ingredient.proteinG, 1)} g`}</td>
                  <td className="px-3 py-2 text-right">{ingredient.carbohydrateG === null ? "—" : `${round(ingredient.carbohydrateG, 1)} g`}</td>
                  <td className="px-3 py-2 text-right">{ingredient.totalFatG === null ? "—" : `${round(ingredient.totalFatG, 1)} g`}</td>
                  <td className="px-3 py-2 text-right">{ingredient.sodiumMg === null ? "—" : `${round(ingredient.sodiumMg)} mg`}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    <div>{ingredient.sourceName ?? ingredient.sourceType ?? "—"}</div>
                    {ingredient.sourceName && ingredient.sourceType && <div className="text-xs text-zinc-600">{ingredient.sourceType}</div>}
                  </td>
                  <td className={`px-3 py-2 capitalize ${confidenceClass(ingredient.confidence)}`}>
                    {ingredient.confidence ?? "—"}{ingredient.manualOverride ? " · override" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
