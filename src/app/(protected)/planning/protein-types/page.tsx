// src/app/(protected)/planning/protein-types/page.tsx
//
// Planning > Protein Types
//
// Master list of protein types used throughout the Cookbook.
//
// Protein Types are assigned to Main Dishes and Menu Items to support
// organization, filtering, searching, and menu planning. This list changes
// infrequently but serves as shared reference data throughout the Cookbook.

export default function ProteinTypesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Protein Types</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Manage the master list of protein types used throughout the
        Cookbook. Protein types help organize recipes and menu items and
        provide consistent filtering across the application.
      </p>
    </>
  );
}