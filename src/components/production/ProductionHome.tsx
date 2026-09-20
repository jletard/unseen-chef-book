"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useProductionWeek } from "@/components/page/ProductionWeekProvider";
import ProductionRecipeModal from "@/components/production/ProductionRecipeModal";
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
  const [recipeTarget, setRecipeTarget] = useState<{
    name: string;
    recipeId: string | null;
    photoUrl: string | null;
  } | null>(null);

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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-zinc-800 pb-1.5">
        <h1 className="text-lg font-bold">Production</h1>
        <span className="text-xs font-medium text-zinc-400">
          {productionWeek ? formatWeek(productionWeek) : ""}
        </span>
        {summary ? (
          <div className="flex flex-wrap items-center gap-x-3 text-xs">
            <span><b>{summary.confirmedOrderCount}</b> <span className="text-zinc-500">orders</span></span>
            <span><b>{summary.totalPortions}</b> <span className="text-zinc-500">meal portions</span></span>
            <span><b>{distinctFoodItems}</b> <span className="text-zinc-500">things</span></span>
          </div>
        ) : null}
        <Link href="/production/list" className="ml-auto shrink-0 text-xs text-blue-300 hover:underline">
          Totals →
        </Link>
      </div>

      {loading ? <p className="mt-6 text-sm text-zinc-500">Loading this week…</p> : null}
      {error ? (
        <p className="mt-6 border border-red-900 bg-red-950/20 p-3 text-sm text-red-300">{error}</p>
      ) : null}

      {summary ? (
        <>
          <section className="mt-1.5">

            {weeklyItems.length === 0 && bulkItems.length === 0 ? (
              <div className="border border-dashed border-zinc-700 p-2 text-sm text-zinc-500">
                No confirmed production for this week.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                <section className="border border-zinc-800 bg-zinc-950">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-0.5 text-sm">
                    <h3 className="font-semibold">Weekly Menu</h3>
                    <span className="text-[10px] text-zinc-600">{weeklyItems.length} items</span>
                  </div>
                  <div className="divide-y divide-zinc-800 border-b border-zinc-800">
                    {weeklyItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() =>
                          setRecipeTarget({
                            name: item.name,
                            recipeId: item.recipeId,
                            photoUrl: item.photoUrl,
                          })
                        }
                        className="flex w-full items-start justify-between gap-2 px-2 py-0.5 text-left text-xs hover:bg-zinc-900 focus:bg-zinc-900 sm:text-sm"
                      >
                        <div className="min-w-0 font-medium leading-tight">
                          {item.name}
                          {!item.photoUrl ? (
                            <span className="ml-1 text-amber-300" title="Needs picture" aria-label="Needs picture">*</span>
                          ) : null}
                        </div>
                        <div className="shrink-0 font-bold">×{item.quantity}</div>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="border border-zinc-800 bg-zinc-950">
                  <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-0.5 text-sm">
                    <h3 className="font-semibold">Bulk Meal Prep</h3>
                    <span className="text-[10px] text-zinc-600">{bulkItems.length} items</span>
                  </div>
                  {bulkItems.length ? (
                    <div className="divide-y divide-zinc-800">
                      {bulkItems.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() =>
                            setRecipeTarget({
                              name: item.name,
                              recipeId: item.recipeId,
                              photoUrl: item.photoUrl,
                            })
                          }
                          className="flex w-full items-start justify-between gap-2 px-2 py-0.5 text-left text-xs hover:bg-zinc-900 focus:bg-zinc-900 sm:text-sm"
                        >
                          <div className="min-w-0 font-medium leading-tight">
                            {item.name}
                            {!item.photoUrl ? (
                              <span className="ml-1 text-amber-300" title="Needs picture" aria-label="Needs picture">*</span>
                            ) : null}
                          </div>
                          <div className="shrink-0 whitespace-nowrap font-bold">
                            ×{item.quantity} <span className="font-normal text-zinc-400">{item.unitLabel}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-2 text-sm text-zinc-500">No bulk items this week.</div>
                  )}
                </section>
              </div>
            )}
          </section>
        </>
      ) : null}
      <ProductionRecipeModal
        target={recipeTarget}
        onClose={() => setRecipeTarget(null)}
      />
    </div>
  );
}
