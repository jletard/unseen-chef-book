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

const actions = [
  { href: "/production/list", title: "Production Totals", detail: "What we are making and how many." },
  { href: "/production/prep", title: "Prep List", detail: "Turn production into actual kitchen work." },
  { href: "/cook/this-week", title: "Scaled Recipes", detail: "The recipes needed for this production week." },
  { href: "/production/shopping", title: "Shopping", detail: "What needs to be bought before cooking starts." },
  { href: "/production/labels", title: "Labels", detail: "Print the food labels after the cooking is done." },
];

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
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
            Production Book
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">What are we cooking?</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            This is the working side of Book: totals, prep, recipes, shopping, and labels for the selected week.
          </p>
        </div>
        <div className="text-sm text-zinc-400">
          {productionWeek ? formatWeek(productionWeek) : ""}
        </div>
      </div>

      {loading ? <p className="mt-6 text-sm text-zinc-500">Loading this week…</p> : null}
      {error ? (
        <p className="mt-6 border border-red-900 bg-red-950/20 p-3 text-sm text-red-300">{error}</p>
      ) : null}

      {summary ? (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Confirmed orders</div>
              <div className="mt-2 text-3xl font-bold">{summary.confirmedOrderCount}</div>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Meal portions</div>
              <div className="mt-2 text-3xl font-bold">{summary.totalPortions}</div>
            </div>
            <div className="border border-zinc-800 bg-zinc-950 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Things to make</div>
              <div className="mt-2 text-3xl font-bold">{distinctFoodItems}</div>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-xl font-bold">Kitchen work</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-600 hover:bg-zinc-900"
                >
                  <div className="font-semibold">{action.title}</div>
                  <p className="mt-1 text-sm text-zinc-500">{action.detail}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">This week</h2>
                <p className="mt-1 text-sm text-zinc-500">The fast answer before you start opening reports.</p>
              </div>
              <Link href="/production/list" className="text-sm text-blue-300 hover:underline">
                Full production totals →
              </Link>
            </div>

            <div className="mt-3 border border-zinc-800 bg-zinc-950">
              {weeklyItems.length === 0 && bulkItems.length === 0 ? (
                <div className="p-5 text-sm text-zinc-500">No confirmed production for this week.</div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {weeklyItems.slice(0, 12).map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.name}</div>
                        <div className="mt-0.5 text-xs text-zinc-600">{item.category}</div>
                      </div>
                      <div className="shrink-0 text-xl font-bold">× {item.quantity}</div>
                    </div>
                  ))}
                  {bulkItems.slice(0, Math.max(0, 12 - weeklyItems.length)).map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.name}</div>
                        <div className="mt-0.5 text-xs text-zinc-600">Bulk · {item.unitLabel}</div>
                      </div>
                      <div className="shrink-0 text-xl font-bold">× {item.quantity}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
