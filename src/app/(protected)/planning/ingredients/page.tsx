import Link from "next/link";

import IngredientCatalog from "@/components/planning/IngredientCatalog";
import { getIngredientComponents, getIngredients } from "@/lib/recipe-data";

export default async function IngredientsPage() {
  const [ingredients, components] = await Promise.all([
    getIngredients(),
    getIngredientComponents(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Ingredients</h1>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Purchased ingredients used by main recipes, sides, and components. Compound ingredients can contain other purchased ingredients for labeling and future nutrition calculations.
        </p>
        <Link
          href="/planning/ingredients/review"
          className="border border-amber-700 bg-amber-950/20 px-4 py-2 text-sm font-semibold text-amber-200"
        >
          Open Review Workspace
        </Link>
      </div>
      <IngredientCatalog ingredients={ingredients} components={components} />
    </>
  );
}
