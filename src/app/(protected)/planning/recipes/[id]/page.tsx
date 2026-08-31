import { notFound } from "next/navigation";

import RecipeEditor from "@/components/planning/RecipeEditor";
import {
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
      <h1 className="text-2xl font-bold">{recipe.name}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Define the smallest practical batch, purchased ingredients, reusable
        components, and ordered preparation steps.
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
