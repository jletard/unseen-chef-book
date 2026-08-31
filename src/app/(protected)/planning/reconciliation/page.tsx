import { getMenuItems } from "@/lib/cookbook-data";

export default async function ReconciliationPage() {
  const items = await getMenuItems();
  const activeItems = items.filter((item) => item.active);
  const inactiveItems = items.filter((item) => !item.active);
  const orderedItems = [...activeItems, ...inactiveItems];

  return (
    <>
      <h1 className="text-2xl font-bold">Production Reconciliation</h1>

      <p className="mt-2 max-w-4xl text-sm text-zinc-400">
        Menu items that still need their production recipe, ingredients, and
        prep requirements defined. These checks will become automatic when the
        Cookbook recipe tables are created.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Menu items
          </div>
          <div className="mt-1 text-xl font-bold">{items.length}</div>
        </div>
        <div className="border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Active priority
          </div>
          <div className="mt-1 text-xl font-bold">{activeItems.length}</div>
        </div>
        <div className="border border-amber-900 bg-amber-950/20 p-3">
          <div className="text-xs uppercase tracking-wide text-amber-500">
            Awaiting breakdown
          </div>
          <div className="mt-1 text-xl font-bold text-amber-300">
            {items.length}
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto border border-zinc-800">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-zinc-950 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Menu item</th>
              <th className="px-3 py-2">Menu status</th>
              <th className="px-3 py-2">Recipe</th>
              <th className="px-3 py-2">Ingredients</th>
              <th className="px-3 py-2">Prep needs</th>
            </tr>
          </thead>
          <tbody>
            {orderedItems.map((item) => (
              <tr
                key={item.id}
                className={
                  "border-t border-zinc-800 " +
                  (item.active ? "" : "text-zinc-500")
                }
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-zinc-100">
                    {item.shortName || item.name}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {item.menuType.replaceAll("_", " ")}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {item.active ? "Active" : "Inactive"}
                </td>
                <td className="px-3 py-2 text-amber-300">Not defined</td>
                <td className="px-3 py-2 text-amber-300">Not defined</td>
                <td className="px-3 py-2 text-amber-300">Not defined</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
