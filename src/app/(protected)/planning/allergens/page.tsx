import AllergenCatalog from "@/components/planning/AllergenCatalog";
import { getLabelingWorkspace } from "@/lib/labeling-data";

export default async function AllergensPage() {
  const { ingredients } = await getLabelingWorkspace();
  return (
    <>
      <h1 className="text-2xl font-bold">Allergen &amp; Labeling Data</h1>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">
        Confirm the consumer ingredient declaration and major allergens for every purchased ingredient. Recipe labels inherit this data through every prepared component.
      </p>
      <AllergenCatalog ingredients={ingredients} />
    </>
  );
}

