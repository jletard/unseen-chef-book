import IngredientReviewWorkspace from "@/components/planning/IngredientReviewWorkspace";
import { getLabelingWorkspace } from "@/lib/labeling-data";
import { getIngredientComponents, getIngredients } from "@/lib/recipe-data";

export default async function IngredientReviewPage() {
  const [ingredients, components, labelingWorkspace] = await Promise.all([
    getIngredients(),
    getIngredientComponents(),
    getLabelingWorkspace(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Ingredient Review Workspace</h1>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">
        Everything that needs review, open at once. Fix label wording, paste supplier ingredient lists,
        flag allergens, and add child ingredients for compound products without opening each record separately.
      </p>
      <IngredientReviewWorkspace
        ingredients={ingredients}
        components={components}
        labeling={labelingWorkspace.ingredients}
      />
    </>
  );
}
