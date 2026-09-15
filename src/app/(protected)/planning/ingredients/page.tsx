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
      <p className="mt-2 text-sm text-zinc-400">
        Purchased ingredients used by main recipes, sides, and components. Compound ingredients can contain other purchased ingredients for labeling and future nutrition calculations.
      </p>
      <IngredientCatalog ingredients={ingredients} components={components} />
    </>
  );
}
