import MenuItemCatalog from "@/components/planning/MenuItemCatalog";
import { getMenuItems } from "@/lib/cookbook-data";
import {
  getMenuItemRecipeLinks,
  getRecipes,
} from "@/lib/recipe-data";

export default async function MenuItemsPage() {
  const [items, recipes, links] = await Promise.all([
    getMenuItems(),
    getRecipes(),
    getMenuItemRecipeLinks(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">Menu Items</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Connect each customer-facing menu item to its production recipes and
        reusable components. Menu names, prices, and availability remain in
        Admin.
      </p>
      <MenuItemCatalog items={items} recipes={recipes} links={links} />
    </>
  );
}
