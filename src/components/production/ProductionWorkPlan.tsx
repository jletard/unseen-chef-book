"use client";

import { useEffect, useMemo, useState } from "react";

import { useProductionWeek } from "@/components/page/ProductionWeekProvider";
type ProductionWorkTask = {
  id: string;
  productionWeek: string;
  workDate: string;
  taskKey: string;
  category: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  status: "planned" | "in_progress" | "complete";
  sourceType: "manual" | "generated";
  notes: string | null;
  sortOrder: number;
};

const categoryOrder = [
  "Proteins",
  "Vegetables",
  "Starches",
  "Sauces & Components",
  "Assembly & Packing",
  "Customers",
  "Studio",
];

function formatDay(value: string) {
  const date = new Date(value + "T12:00:00");
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function quantityText(task: ProductionWorkTask) {
  if (task.quantity === null) return null;
  const qty = Number.isInteger(task.quantity)
    ? String(task.quantity)
    : Number(task.quantity.toFixed(2)).toString();
  return task.unit ? qty + " " + task.unit : qty;
}

export default function ProductionWorkPlan() {
  const { productionWeek } = useProductionWeek();
  const [tasks, setTasks] = useState<ProductionWorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "/api/production/work-plan?production_week=" +
            encodeURIComponent(productionWeek),
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to load kitchen work.");
        }
        setTasks(result as ProductionWorkTask[]);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load kitchen work.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [productionWeek]);

  const days = useMemo(() => {
    const grouped = new Map<string, ProductionWorkTask[]>();
    for (const task of tasks) {
      const list = grouped.get(task.workDate) ?? [];
      list.push(task);
      grouped.set(task.workDate, list);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  async function setStatus(
    task: ProductionWorkTask,
    status: ProductionWorkTask["status"],
  ) {
    const previous = tasks;
    setSavingId(task.id);
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status } : item)),
    );

    try {
      const response = await fetch("/api/production/work-plan", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: task.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save task.");
    } catch (saveError) {
      setTasks(previous);
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save task.",
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className="mt-6 text-sm text-zinc-500">Building the kitchen day…</p>;
  }

  if (error && tasks.length === 0) {
    return (
      <p className="mt-6 border border-red-900 bg-red-950/20 p-3 text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="mt-6 border border-dashed border-zinc-700 p-5 text-sm text-zinc-500">
        No kitchen-day plan has been built for this production week yet.
      </div>
    );
  }

  return (
    <section className="mt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold">Kitchen day</h2>
        <span className="text-[11px] text-zinc-600">tap a box when finished</span>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      ) : null}

      <div className="mt-2 space-y-2">
        {days.map(([date, dayTasks]) => {
          const completeCount = dayTasks.filter(
            (task) => task.status === "complete",
          ).length;
          const categories = categoryOrder
            .map((category) => ({
              category,
              tasks: dayTasks.filter((task) => task.category === category),
            }))
            .filter((group) => group.tasks.length > 0);

          const extraCategories = Array.from(
            new Set(
              dayTasks
                .map((task) => task.category)
                .filter((category) => !categoryOrder.includes(category)),
            ),
          ).map((category) => ({
            category,
            tasks: dayTasks.filter((task) => task.category === category),
          }));

          return (
            <article key={date} className="border border-zinc-800 bg-zinc-950">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-1.5">
                <div>
                  <h3 className="text-sm font-bold">{formatDay(date)}</h3>
                  <div className="text-[11px] text-zinc-600">{completeCount}/{dayTasks.length} complete</div>
                </div>
                {completeCount === dayTasks.length ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    Done
                  </span>
                ) : null}
              </header>

              <div className="divide-y divide-zinc-900">
                {[...categories, ...extraCategories].map((group) => (
                  <section
                    key={group.category}
                    className="grid gap-1 px-3 py-2 lg:grid-cols-[145px_1fr]"
                  >
                    <div className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {group.category}
                    </div>

                    <div className="space-y-1">
                      {group.tasks.map((task) => {
                        const qty = quantityText(task);
                        const done = task.status === "complete";

                        return (
                          <div
                            key={task.id}
                            className={[
                              "flex items-start gap-2 border border-zinc-800 px-2 py-1.5 text-sm",
                              done ? "bg-zinc-900/40" : "bg-zinc-950",
                            ].join(" ")}
                          >
                            <button
                              type="button"
                              disabled={savingId === task.id}
                              onClick={() =>
                                void setStatus(
                                  task,
                                  done ? "planned" : "complete",
                                )
                              }
                              className={[
                                "flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] font-bold",
                                done
                                  ? "border-emerald-700 bg-emerald-950 text-emerald-300"
                                  : "border-zinc-700 text-zinc-700 hover:border-zinc-500",
                              ].join(" ")}
                              aria-label={
                                done ? "Mark not complete" : "Mark complete"
                              }
                            >
                              {done ? "✓" : ""}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div
                                className={[
                                  "font-medium",
                                  done
                                    ? "text-zinc-500 line-through"
                                    : "text-zinc-100",
                                ].join(" ")}
                              >
                                {task.label}
                                {qty ? (
                                  <span className="ml-1 text-xs font-normal text-zinc-400">
                                    · {qty}
                                  </span>
                                ) : null}
                              </div>
                              {task.notes ? (
                                <p className="text-[11px] leading-4 text-zinc-600">
                                  {task.notes}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
