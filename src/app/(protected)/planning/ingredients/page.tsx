import IngredientCatalog from "@/components/planning/IngredientCatalog";
import { getIngredients } from "@/lib/recipe-data";

export default async function IngredientsPage() {
  const ingredients = await getIngredients();

  return (
    <>
      <h1 className="text-2xl font-bold">Ingredients</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Purchased ingredients used by main recipes, sides, and components.
      </p>
      <IngredientCatalog ingredients={ingredients} />
    </>
  );
}
