"use client";

import { useEffect, useState } from "react";

import { useProductionWeek } from "@/components/page/ProductionWeekProvider";
import type { ProductionSummary } from "@/types/cookbook-data";

function formatWeek(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

export default function ProductionList() {
  const { productionWeek } = useProductionWeek();
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProduction() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/production?production_week=" +
            encodeURIComponent(productionWeek),
          { cache: "no-store", signal: controller.signal },
        );
        const result = (await response.json()) as
          | ProductionSummary
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in result && result.error
              ? result.error
              : "Failed to load production.",
          );
        }

        setSummary(result as ProductionSummary);
      } catch (loadError) {
        if (controller.signal.aborted) return;

        setSummary(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load production.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProduction();
    return () => controller.abort();
  }, [productionWeek]);

  if (loading) {
    return <p className="mt-6 text-sm text-zinc-400">Loading production…</p>;
  }

  if (error) {
    return (
      <p className="mt-6 border border-red-900 bg-red-950/20 p-3 text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (!summary) return null;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Production week
          </div>
          <div className="mt-1 font-semibold">
            {formatWeek(summary.productionWeek)}
          </div>
        </div>
        <div className="border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Confirmed orders
          </div>
          <div className="mt-1 text-xl font-bold">
            {summary.confirmedOrderCount}
          </div>
        </div>
        <div className="border border-zinc-800 bg-zinc-950 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Portions
          </div>
          <div className="mt-1 text-xl font-bold">
            {summary.totalPortions}
          </div>
        </div>
      </div>

      {summary.items.length === 0 && summary.bulkItems.length === 0 ? (
        <p className="border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
          No confirmed production for this week.
        </p>
      ) : null}

      {summary.items.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Weekly Menu Production</h2>
          <div className="overflow-x-auto border border-zinc-800">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead className="bg-zinc-950 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2 text-right">Quantity</th>
                  <th className="px-3 py-2">Side requirements</th>
                </tr>
              </thead>
              <tbody>
                {summary.items.map((item) => (
                  <tr key={item.key} className="border-t border-zinc-800">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-zinc-400">{item.category}</td>
                    <td className="px-3 py-2 text-right text-lg font-bold">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {item.sideRequirements.length
                        ? item.sideRequirements
                            .map((side) => side.name + " × " + side.quantity)
                            .join(" · ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {summary.bulkItems.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Bulk Meal Prep</h2>
          <div className="overflow-x-auto border border-zinc-800">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="bg-zinc-950 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {summary.bulkItems.map((item) => (
                  <tr key={item.key} className="border-t border-zinc-800">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-zinc-400">{item.category}</td>
                    <td className="px-3 py-2 text-zinc-300">{item.unitLabel}</td>
                    <td className="px-3 py-2 text-right text-lg font-bold">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
