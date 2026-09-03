import LabelSheetBuilder from "@/components/production/LabelSheetBuilder";
import { getLabelingWorkspace } from "@/lib/labeling-data";

export default async function LabelsPage() {
  const { recipes } = await getLabelingWorkspace();
  return (
    <>
      <h1 className="text-2xl font-bold">Grab-and-Go Labels</h1>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">
        Generate six-per-sheet Avery 6464 labels from approved recipes. Printing is blocked until every included purchased ingredient has confirmed labeling data.
      </p>
      <LabelSheetBuilder recipes={recipes} />
    </>
  );
}

