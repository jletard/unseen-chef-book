import ReferenceCatalog from "@/components/planning/ReferenceCatalog";
import { getReferenceRecords } from "@/lib/cookbook-data";

export default async function ProteinTypesPage() {
  const proteinTypes = await getReferenceRecords("protein_types");

  return (
    <>
      <h1 className="text-2xl font-bold">Protein Types</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Read-only protein-type list shared with Admin and the ordering system.
      </p>
      <ReferenceCatalog
        records={proteinTypes}
        emptyMessage="No protein types are currently defined."
      />
    </>
  );
}
