"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type IdentityTask = {
  id: string;
  task_type: string;
  subject_type: string;
  subject_id: string;
  status: string;
  priority: number;
  candidate_payload: Record<string, unknown> | null;
};

type ProductionItem = {
  id: string;
  name: string;
  kind: string;
  active: boolean;
};

export default function IdentityDecisionResolver() {
  const router = useRouter();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<IdentityTask[]>([]);
  const [productionItems, setProductionItems] = useState<ProductionItem[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    function locateCard() {
      const label = Array.from(document.querySelectorAll("div")).find(
        (element) => element.textContent?.trim().toLowerCase() === "identity decisions",
      );
      const card = label?.parentElement;
      setTarget(card instanceof HTMLElement ? card : null);
    }

    locateCard();
    const observer = new MutationObserver(locateCard);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reconciliation/identity-decisions", { cache: "no-store" });
      const result = await response.json() as {
        tasks?: IdentityTask[];
        productionItems?: ProductionItem[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Identity decisions could not be loaded.");
      setTasks(result.tasks ?? []);
      setProductionItems(result.productionItems ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Identity decisions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function showResolver() {
    setOpen(true);
    await load();
  }

  async function resolveTask(task: IdentityTask, action: "map" | "create") {
    setBusyTaskId(task.id);
    setError("");
    try {
      const response = await fetch("/api/reconciliation/identity-decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          action,
          ...(action === "map" ? { productionItemId: selections[task.id] } : {}),
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Identity decision could not be resolved.");
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setSelections((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      router.refresh();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Identity decision could not be resolved.");
    } finally {
      setBusyTaskId(null);
    }
  }

  const trigger = target
    ? createPortal(
        <button
          type="button"
          onClick={showResolver}
          className="mt-2 border border-amber-600 px-3 py-1 text-xs font-semibold text-amber-200"
        >
          Resolve decisions
        </button>,
        target,
      )
    : null;

  const dialog = open
    ? createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:p-8">
          <div className="w-full max-w-4xl border border-zinc-700 bg-zinc-950 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Identity decisions</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Decide whether each unmatched source is an existing production item or a genuinely new one.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="border border-zinc-700 px-3 py-2 text-sm">
                Close
              </button>
            </div>

            {error && <div className="mt-4 border border-red-900 bg-red-950/20 p-3 text-sm text-red-300">{error}</div>}
            {loading ? (
              <p className="mt-4 text-sm text-zinc-400">Loading decisions…</p>
            ) : tasks.length === 0 ? (
              <p className="mt-4 border border-emerald-900 bg-emerald-950/10 p-4 text-emerald-300">
                No identity decisions remain.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {tasks.map((task) => {
                  const candidate = task.candidate_payload ?? {};
                  const sourceName = String(candidate.source_name ?? candidate.name ?? task.subject_id);
                  const reason = String(candidate.reason ?? "This source could not be matched automatically.");
                  const isSourceMapping = task.task_type === "source_mapping";
                  const choices = productionItems.filter((item) =>
                    task.subject_type === "embedded_side" ? item.kind === "side" || item.kind === "bulk_side" : true,
                  );

                  return (
                    <div key={task.id} className="border border-zinc-800 bg-black p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase text-amber-400">{task.task_type.replaceAll("_", " ")}</div>
                          <div className="mt-1 text-lg font-semibold">{sourceName}</div>
                          <div className="mt-1 text-sm text-zinc-400">{reason}</div>
                        </div>
                        <div className="text-xs text-zinc-500">{task.subject_type.replaceAll("_", " ")}</div>
                      </div>

                      {isSourceMapping ? (
                        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
                          <select
                            value={selections[task.id] ?? ""}
                            onChange={(event) => setSelections((current) => ({ ...current, [task.id]: event.target.value }))}
                            disabled={busyTaskId === task.id}
                            className="min-w-0 border border-zinc-700 bg-black px-3 py-2 text-white disabled:opacity-40"
                          >
                            <option value="">Map to existing side…</option>
                            {choices.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (inactive)"}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => resolveTask(task, "map")}
                            disabled={busyTaskId === task.id || !selections[task.id]}
                            className="border border-blue-600 px-4 py-2 font-medium text-blue-200 disabled:opacity-40"
                          >
                            Use existing
                          </button>
                          <button
                            type="button"
                            onClick={() => resolveTask(task, "create")}
                            disabled={busyTaskId === task.id}
                            className="border border-emerald-600 px-4 py-2 font-medium text-emerald-200 disabled:opacity-40"
                          >
                            Create new side
                          </button>
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-amber-300">
                          This decision type is visible now, but it needs its own matching workflow before it can be resolved here.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return <>{trigger}{dialog}</>;
}
