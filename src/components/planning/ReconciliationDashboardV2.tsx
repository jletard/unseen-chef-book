import type { ReconciliationDashboard } from "@/lib/cookbook-v2/reconciliation-data";

const kindLabels: Record<string, string> = {
  menu_item: "Menu item",
  side: "Side",
  bulk_protein: "Bulk protein",
  bulk_side: "Bulk side",
  component: "Component",
  other: "Other",
};

export default function ReconciliationDashboardV2({
  dashboard,
}: {
  dashboard: ReconciliationDashboard;
}) {
  const visibleQueue = dashboard.queue.slice(0, 100);

  return (
    <>
      <h1 className="text-2xl font-bold">Production Reconciliation</h1>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">
        One production-knowledge queue for menu items, sides, bulk offerings,
        reusable components, and identity decisions. Nothing is combined merely
        because its name looks similar.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Production items" value={dashboard.totalProductionItems} />
        <SummaryCard label="Missing recipes" value={dashboard.missingRecipes} warning />
        <SummaryCard
          label="Identity decisions"
          value={dashboard.openIdentityDecisions}
          warning
        />
        <SummaryCard
          label="Drafts ready"
          value={dashboard.draftCounts.ready ?? 0}
        />
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Fast review queue</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Active work comes first. The first pass will support Keep or Edit;
              later passes split edits into Minor and Major piles.
            </p>
          </div>
          <div className="text-sm text-zinc-400">
            Showing {visibleQueue.length} of {dashboard.queue.length}
          </div>
        </div>

        <div className="mt-3 overflow-x-auto border border-zinc-800">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Production item</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Review</th>
              </tr>
            </thead>
            <tbody>
              {visibleQueue.map((row) => (
                <tr key={row.id} className="border-b border-zinc-900 last:border-0">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {kindLabels[row.kind] ?? row.kind}
                  </td>
                  <td className="px-4 py-3">
                    <span className={row.active ? "text-emerald-400" : "text-zinc-500"}>
                      {row.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-amber-300">
                    {row.reviewBucket ?? "Needs recipe"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SummaryCard({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div
      className={
        warning
          ? "border border-amber-900 bg-amber-950/20 p-3"
          : "border border-zinc-800 bg-zinc-950 p-3"
      }
    >
      <div className={warning ? "text-xs uppercase text-amber-500" : "text-xs uppercase text-zinc-500"}>
        {label}
      </div>
      <div className={warning ? "mt-1 text-xl font-bold text-amber-300" : "mt-1 text-xl font-bold"}>
        {value}
      </div>
    </div>
  );
}
