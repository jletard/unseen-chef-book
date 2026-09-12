import DataRepairTool from "@/components/planning/DataRepairTool";
import {
  getMenuItems,
  getReferenceRecords,
} from "@/lib/cookbook-data";
import { getIngredients } from "@/lib/recipe-data";

export default async function DataRepairPage() {
  const [menuItems, sides, categories, proteinTypes, ingredients] =
    await Promise.all([
      getMenuItems(),
      getReferenceRecords("side_items"),
      getReferenceRecords("categories"),
      getReferenceRecords("protein_types"),
      getIngredients(),
    ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Data Repair</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Find duplicate catalog values, preview current references, and merge the
        duplicates into one canonical value. Historical orders are never
        changed.
      </p>
      <DataRepairTool
        menuItems={menuItems}
        records={{
          sides,
          categories,
          proteinTypes,
          ingredients: ingredients.map((ingredient) => ({
            id: ingredient.id,
            name: ingredient.name,
            active: ingredient.active,
            sortOrder: 0,
          })),
        }}
      />
    </>
  );
}
