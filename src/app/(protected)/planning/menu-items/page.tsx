import MenuItemCatalog from "@/components/planning/MenuItemCatalog";
import { getMenuItems } from "@/lib/cookbook-data";

export default async function MenuItemsPage() {
  const items = await getMenuItems();

  return (
    <>
      <h1 className="text-2xl font-bold">Menu Items</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Read-only culinary catalog from Admin. Use this list to connect each
        customer-facing menu item to its production recipe and requirements.
        Menu editing remains in Admin.
      </p>

      <MenuItemCatalog items={items} />
    </>
  );
}
