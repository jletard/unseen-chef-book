import type { MenuItemRecord } from "@/types/cookbook-data";

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function MenuItemCatalog({
  items,
}: {
  items: MenuItemRecord[];
}) {
  const activeCount = items.filter((item) => item.active).length;

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap gap-3 text-sm text-zinc-400">
        <span>{items.length} catalog items</span>
        <span>{activeCount} active</span>
        <span>{items.length - activeCount} inactive</span>
      </div>

      <div className="overflow-x-auto border border-zinc-800">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead className="bg-zinc-950 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Menu item</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Protein</th>
              <th className="px-3 py-2">Default sides</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={
                  "border-t border-zinc-800 " +
                  (item.active ? "" : "text-zinc-500")
                }
              >
                <td className="max-w-md px-3 py-2">
                  <div className="font-medium text-zinc-100">
                    {item.shortName || item.name}
                    {item.isVegan ? (
                      <span className="ml-2 text-xs text-emerald-400">Vegan</span>
                    ) : null}
                  </div>
                  {item.shortName && item.shortName !== item.name ? (
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {item.name}
                    </div>
                  ) : null}
                  <div className="mt-1 line-clamp-2 text-xs text-zinc-400">
                    {item.description}
                  </div>
                </td>
                <td className="px-3 py-2">{label(item.menuType)}</td>
                <td className="px-3 py-2">{item.category || "—"}</td>
                <td className="px-3 py-2">{item.proteinType || "—"}</td>
                <td className="px-3 py-2">
                  {item.sides.length ? item.sides.join(" · ") : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      item.active ? "text-emerald-400" : "text-zinc-500"
                    }
                  >
                    {item.active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
