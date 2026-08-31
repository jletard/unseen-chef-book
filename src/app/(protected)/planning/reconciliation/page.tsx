import Link from "next/link";

import MenuItemCatalog from "@/components/planning/MenuItemCatalog";
import { getMenuItems } from "@/lib/cookbook-data";
import {
  getMenuItemRecipeLinks,
  getRecipes,
} from "@/lib/recipe-data";

export default async function ReconciliationPage() {
  const [items, recipes, links] = await Promise.all([
    getMenuItems(),
    getRecipes(),
    getMenuItemRecipeLinks(),
  ]);
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const incompleteRecipes = recipes.filter(
    (recipe) => recipe.status === "draft",
  );
  const awaitingItems = items.filter((item) => {
    const itemRecipes = links
      .filter((link) => link.menuItemId === item.id)
      .map((link) => recipesById.get(link.recipeId))
      .filter((recipe) => recipe !== undefined);
    const mainRecipe = itemRecipes.find(
      (recipe) => recipe.recipeType !== "component",
    );

    return !mainRecipe || mainRecipe.status !== "complete";
  });

  return (
    <>
      <h1 className="text-2xl font-bold">Production Reconciliation</h1>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">
        Create, attach, and finish the production knowledge still missing from
        menu items. Every catalog item belongs here until its recipe breakdown
        is complete, regardless of whether it is currently offered for sale.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs uppercase text-zinc-500">Menu items</div>
          <div className="mt-1 text-xl font-bold">{items.length}</div>
        </div>
        <div className="border border-amber-900 bg-amber-950/20 p-3">
          <div className="text-xs uppercase text-amber-500">
            Awaiting complete main recipe
          </div>
          <div className="mt-1 text-xl font-bold text-amber-300">
            {awaitingItems.length}
          </div>
        </div>
        <div className="border border-amber-900 bg-amber-950/20 p-3">
          <div className="text-xs uppercase text-amber-500">Draft recipes</div>
          <div className="mt-1 text-xl font-bold text-amber-300">
            {incompleteRecipes.length}
          </div>
        </div>
      </div>

      {incompleteRecipes.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Incomplete recipes</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {incompleteRecipes.map((recipe) => (
              <div key={recipe.id} className="border border-zinc-800 p-3">
                <Link
                  href={"/planning/recipes/" + recipe.id}
                  className="font-medium text-blue-300 hover:underline"
                >
                  {recipe.name}
                </Link>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-xs capitalize text-amber-300">
                    Draft {recipe.recipeType}
                  </span>
                  <Link
                    href={"/planning/recipes/" + recipe.id}
                    className="border border-blue-500 px-2 py-1 text-xs"
                  >
                    Edit Recipe
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Menu items needing production planning
        </h2>
        {awaitingItems.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-400">
            Every menu item has a complete main recipe.
          </p>
        ) : (
          <MenuItemCatalog
            items={awaitingItems}
            recipes={recipes}
            links={links}
          />
        )}
      </section>
    </>
  );
}
