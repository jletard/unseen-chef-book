import Link from "next/link";
import { notFound } from "next/navigation";

import ApprovedRecipeEditor from "@/components/planning/ApprovedRecipeEditor";
import RecipeEditor from "@/components/planning/RecipeEditor";
import {
  getApprovedRecipeEditorData,
  getIngredients,
  getRecipeById,
  getRecipeItems,
  getRecipes,
  getRecipeSteps,
} from "@/lib/recipe-data";

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const approved = await getApprovedRecipeEditorData(id);

  if (approved) {
    return (
      <>
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <Link href="/planning/reconciliation" className="text-blue-300 hover:underline">
            ← Reconciliation
          </Link>
          <Link
            href={approved.recipeType === "component" ? "/planning/components" : "/planning/main-dishes"}
            className="text-blue-300 hover:underline"
          >
            {approved.recipeType === "component" ? "Components" : "Main Dishes"}
          </Link>
        </div>
        <h1 className="text-2xl font-bold">{approved.name}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Edit the current approved recipe. Saving creates a new approved version and preserves the prior version.
        </p>
        <ApprovedRecipeEditor data={approved} />
      </>
    );
  }

  const [recipe, items, steps, ingredients, recipes] = await Promise.all([
    getRecipeById(id),
    getRecipeItems(id),
    getRecipeSteps(id),
    getIngredients(),
    getRecipes(),
  ]);

  if (!recipe) notFound();

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/planning/reconciliation" className="text-blue-300 hover:underline">
          ← Reconciliation
        </Link>
        <Link
          href={recipe.recipeType === "component" ? "/planning/components" : "/planning/main-dishes"}
          className="text-blue-300 hover:underline"
        >
          {recipe.recipeType === "component" ? "Components" : "Main Dishes"}
        </Link>
      </div>
      <h1 className="text-2xl font-bold">{recipe.name}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Legacy recipe record with no approved version yet.
      </p>
      <RecipeEditor
        recipe={recipe}
        items={items}
        steps={steps}
        ingredients={ingredients}
        recipes={recipes}
      />
    </>
  );
}
