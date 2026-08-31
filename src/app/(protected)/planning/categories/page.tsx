import ReferenceCatalog from "@/components/planning/ReferenceCatalog";
import { getReferenceRecords } from "@/lib/cookbook-data";

export default async function CategoriesPage() {
  const categories = await getReferenceRecords("categories");

  return (
    <>
      <h1 className="text-2xl font-bold">Categories</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Read-only category list shared with Admin and the ordering system.
      </p>
      <ReferenceCatalog
        records={categories}
        emptyMessage="No categories are currently defined."
      />
    </>
  );
}
