"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useProductionWeek } from "@/components/page/ProductionWeekProvider";
import ProductionWorkPlan from "@/components/production/ProductionWorkPlan";
import type { ProductionSummary } from "@/types/cookbook-data";

function formatWeek(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

export default function ProductionHome() {
  const { productionWeek } = useProductionWeek();
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          "/api/production?production_week=" + encodeURIComponent(productionWeek),
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to load production.");
        setSummary(result as ProductionSummary);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load production.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [productionWeek]);

  const weeklyItems = summary?.items ?? [];
  const bulkItems = summary?.bulkItems ?? [];
  const distinctFoodItems = weeklyItems.length + bulkItems.length;

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="text-xl font-bold md:text-2xl">Production</h1>
          <span className="text-xs text-zinc-500">What are we cooking?</span>
        </div>
        <div className="text-xs font-medium text-zinc-400">
          {productionWeek ? formatWeek(productionWeek) : ""}
        </div>
      </div>

      {loading ? <p className="mt-6 text-sm text-zinc-500">Loading this week…</p> : null}
      {error ? (
        <p className="mt-6 border border-red-900 bg-red-950/20 p-3 text-sm text-red-300">{error}</p>
      ) : null}

      {summary ? (
        <>
          <section className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
            <span><b className="text-zinc-100">{summary.confirmedOrderCount}</b> <span className="text-zinc-500">orders</span></span>
            <span><b className="text-zinc-100">{summary.totalPortions}</b> <span className="text-zinc-500">meal portions</span></span>
            <span><b className="text-zinc-100">{distinctFoodItems}</b> <span className="text-zinc-500">things to make</span></span>
          </section>


          <section className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">
                This week <span className="font-normal text-zinc-600">· weekly menu + bulk</span>
              </h2>
              <Link href="/production/list" className="shrink-0 text-xs text-blue-300 hover:underline">
                Totals →
              </Link>
            </div>

            {weeklyItems.length === 0 && bulkItems.length === 0 ? (
              <div className="mt-3 border border-dashed border-zinc-700 p-5 text-sm text-zinc-500">
                No confirmed production for this week.
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <section className="border border-zinc-800 bg-zinc-950">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-2.5 py-1">
                    <h3 className="font-semibold">Weekly Menu</h3>
                    <p className="text-[10px] leading-3 text-zinc-600">
                      {weeklyItems.length} items
                    </p>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {weeklyItems.map((item) => (
                      <div key={item.key} className="flex items-start justify-between gap-2 px-2.5 py-1 text-xs sm:text-sm">
                        <div className="min-w-0 leading-tight">
                          <span className="font-medium">{item.name}</span>
                          <span className="ml-1.5 text-[10px] text-zinc-600">{item.category}</span>
                        </div>
                        <div className="shrink-0 text-sm font-bold">×{item.quantity}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="border border-zinc-800 bg-zinc-950">
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <h3 className="font-semibold">Bulk Meal Prep</h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {bulkItems.length} items
                    </p>
                  </div>
                  {bulkItems.length ? (
                    <div className="divide-y divide-zinc-800">
                      {bulkItems.map((item) => (
                        <div key={item.key} className="flex items-start justify-between gap-2 px-2.5 py-1 text-xs sm:text-sm">
                          <div className="min-w-0 leading-tight">
                            <span className="font-medium">{item.name}</span>
                            <span className="ml-1.5 text-[10px] text-zinc-600">
                              {item.category} · {item.unitLabel}
                            </span>
                          </div>
                          <div className="shrink-0 text-sm font-bold">×{item.quantity}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-zinc-500">No bulk items this week.</div>
                  )}
                </section>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
