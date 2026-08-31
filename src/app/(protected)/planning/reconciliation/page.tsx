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
  const menuRows = items.map((item) => {
    const itemRecipes = links
      .filter((link) => link.menuItemId === item.id)
      .map((link) => recipesById.get(link.recipeId))
      .filter((recipe) => recipe !== undefined);
    const mainRecipe = itemRecipes.find(
      (recipe) => recipe.recipeType !== "component",
    );

    return { item, itemRecipes, mainRecipe };
  });
  const awaitingMenuItems = menuRows.filter(
    ({ mainRecipe }) => !mainRecipe || mainRecipe.status !== "complete",
  );

  return (
    <>
      <h1 className="text-2xl font-bold">Production Reconciliation</h1>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">
        Incomplete menu-item breakdowns and draft recipes stay here until they
        are ready for production.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs uppercase text-zinc-500">Menu items</div>
          <div className="mt-1 text-xl font-bold">{items.length}</div>
        </div>
        <div className="border border-amber-900 bg-amber-950/20 p-3">
          <div className="text-xs uppercase text-amber-500">
            Awaiting main recipe
          </div>
          <div className="mt-1 text-xl font-bold text-amber-300">
            {awaitingMenuItems.length}
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
                <div className="font-medium">{recipe.name}</div>
                <div className="mt-1 text-xs capitalize text-amber-300">
                  Draft {recipe.recipeType}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 overflow-x-auto border border-zinc-800">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-zinc-950 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Menu item</th>
              <th className="px-3 py-2">Menu status</th>
              <th className="px-3 py-2">Main recipe</th>
              <th className="px-3 py-2">Attached components</th>
            </tr>
          </thead>
          <tbody>
            {menuRows.map(({ item, itemRecipes, mainRecipe }) => (
              <tr
                key={item.id}
                className={
                  "border-t border-zinc-800 " +
                  (item.active ? "" : "text-zinc-500")
                }
              >
                <td className="px-3 py-2">{item.shortName || item.name}</td>
                <td className="px-3 py-2">
                  {item.active ? "Active" : "Inactive"}
                </td>
                <td
                  className={
                    mainRecipe?.status === "complete"
                      ? "px-3 py-2 text-emerald-400"
                      : "px-3 py-2 text-amber-300"
                  }
                >
                  {mainRecipe
                    ? mainRecipe.name + " — " + mainRecipe.status
                    : "Not defined"}
                </td>
                <td className="px-3 py-2">
                  {itemRecipes.filter(
                    (recipe) => recipe.recipeType === "component",
                  ).length || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
