import ReferenceCatalog from "@/components/planning/ReferenceCatalog";
import { getReferenceRecords } from "@/lib/cookbook-data";

export default async function SidesPage() {
  const sides = await getReferenceRecords("side_items");

  return (
    <>
      <h1 className="text-2xl font-bold">Sides</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Read-only side catalog shared with Admin. Recipes and production
        requirements will be connected here after the Cookbook schema is
        defined.
      </p>
      <ReferenceCatalog
        records={sides}
        emptyMessage="No sides are currently defined."
      />
    </>
  );
}
