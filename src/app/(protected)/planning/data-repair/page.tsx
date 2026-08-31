import DataRepairTool from "@/components/planning/DataRepairTool";
import {
  getMenuItems,
  getReferenceRecords,
} from "@/lib/cookbook-data";

export default async function DataRepairPage() {
  const [menuItems, sides, categories, proteinTypes] = await Promise.all([
    getMenuItems(),
    getReferenceRecords("side_items"),
    getReferenceRecords("categories"),
    getReferenceRecords("protein_types"),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Data Repair</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Find duplicate catalog values, preview every current menu item that
        refers to them, and merge the duplicates into one canonical value.
        Historical orders are never changed.
      </p>
      <DataRepairTool
        menuItems={menuItems}
        records={{
          sides,
          categories,
          proteinTypes,
        }}
      />
    </>
  );
}
