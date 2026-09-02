"use client";

import { useMemo, useState } from "react";

import type { ReconciliationDashboard } from "@/lib/cookbook-v2/reconciliation-data";

const kindLabels: Record<string, string> = {
  menu_item: "Menu item",
  side: "Side",
  bulk_protein: "Bulk protein",
  bulk_side: "Bulk side",
  component: "Component",
  other: "Other",
};

type BatchResult = {
  batchId?: string;
  jobCount?: number;
  alreadyExisted?: boolean;
  error?: string;
};

type BatchStatus = {
  id: string;
  name: string;
  status: string;
  requestedCount: number;
  counts: Record<string, number>;
};

export default function ReconciliationDashboardV2({
  dashboard,
}: {
  dashboard: ReconciliationDashboard;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");
  const [batchName, setBatchName] = useState("Production reconciliation batch");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [batches, setBatches] = useState<BatchStatus[]>([]);

  const kinds = useMemo(
    () => Array.from(new Set(dashboard.queue.map((row) => row.kind))).sort(),
    [dashboard.queue],
  );
  const visibleQueue = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return dashboard.queue.filter((row) => {
      if (activityFilter === "active" && !row.active) return false;
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      return !normalizedSearch || row.name.toLocaleLowerCase().includes(normalizedSearch);
    });
  }, [activityFilter, dashboard.queue, kindFilter, search]);

  function toggle(productionItemId: string) {
    setMessage("");
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productionItemId)) {
        next.delete(productionItemId);
      } else if (next.size < 100) {
        next.add(productionItemId);
      } else {
        setMessage("A batch can contain at most 100 recipes.");
      }
      return next;
    });
  }

  function selectVisible() {
    const ids = visibleQueue.slice(0, 100).map((row) => row.productionItemId);
    setSelectedIds(new Set(ids));
    setMessage(
      visibleQueue.length > 100
        ? "Selected the first 100 visible items. Create another batch for the remainder."
        : `Selected ${ids.length} visible items.`,
    );
  }

  async function createBatch() {
    if (selectedIds.size === 0) {
      setMessage("Select at least one production item.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/reconciliation/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: batchName,
          productionItemIds: Array.from(selectedIds),
          requestKey: crypto.randomUUID(),
        }),
      });
      const result = (await response.json()) as BatchResult;
      if (!response.ok) {
        throw new Error(result.error ?? "Batch could not be created.");
      }

      setSelectedIds(new Set());
      setMessage(
        `${result.jobCount ?? 0} recipe jobs queued in “${batchName}”. ` +
          "The generation worker is the next connection; no browser waiting is required.",
      );
      await loadBatches();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function loadBatches() {
    const response = await fetch("/api/reconciliation/batches", { cache: "no-store" });
    const result = (await response.json()) as {
      batches?: BatchStatus[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(result.error ?? "Batch status could not be loaded.");
    }
    setBatches(result.batches ?? []);
  }

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
        <SummaryCard label="Identity decisions" value={dashboard.openIdentityDecisions} warning />
        <SummaryCard label="Drafts ready" value={dashboard.draftCounts.ready ?? 0} />
      </div>

      <section className="mt-8 border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-sm">
            <span className="mb-1 block text-zinc-400">Batch name</span>
            <input
              value={batchName}
              onChange={(event) => setBatchName(event.target.value)}
              maxLength={120}
              className="w-full border border-zinc-700 bg-black px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={createBatch}
            disabled={busy || selectedIds.size === 0 || !batchName.trim()}
            className="border border-blue-500 px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Creating batch…" : `Create batch (${selectedIds.size})`}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-amber-300">{message}</p>}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-800 pt-3">
          <h2 className="font-medium">Recent batches</h2>
          <button
            type="button"
            onClick={() => loadBatches().catch((error) => setMessage(error.message))}
            className="border border-zinc-700 px-3 py-1 text-sm"
          >
            Refresh status
          </button>
        </div>
        {batches.length > 0 && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {batches.map((batch) => (
              <div key={batch.id} className="border border-zinc-800 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{batch.name}</span>
                  <span className="capitalize text-blue-300">{batch.status.replaceAll("_", " ")}</span>
                </div>
                <div className="mt-2 text-zinc-400">
                  {batch.requestedCount} jobs · {batch.counts.ready ?? 0} ready · {batch.counts.failed ?? 0} failed · {batch.counts.queued ?? 0} queued
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Reconciliation candidates</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Select up to 100 items for one isolated generation batch.
            </p>
          </div>
          <div className="text-sm text-zinc-400">
            Showing {visibleQueue.length} of {dashboard.queue.length} · {selectedIds.size} selected
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search production items"
            className="min-w-60 border border-zinc-700 bg-black px-3 py-2 text-sm"
          />
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
            className="border border-zinc-700 bg-black px-3 py-2 text-sm"
          >
            <option value="all">All kinds</option>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabels[kind] ?? kind}
              </option>
            ))}
          </select>
          <select
            value={activityFilter}
            onChange={(event) => setActivityFilter(event.target.value as "active" | "all")}
            className="border border-zinc-700 bg-black px-3 py-2 text-sm"
          >
            <option value="active">Active only</option>
            <option value="all">Active and inactive</option>
          </select>
          <button type="button" onClick={selectVisible} className="border border-zinc-600 px-3 py-2 text-sm">
            Select visible
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedIds(new Set());
              setMessage("");
            }}
            className="border border-zinc-700 px-3 py-2 text-sm text-zinc-300"
          >
            Clear
          </button>
        </div>

        <div className="mt-3 overflow-x-auto border border-zinc-800">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <tr>
                <th className="w-12 px-4 py-3">Pick</th>
                <th className="px-4 py-3">Production item</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {visibleQueue.map((row) => (
                <tr key={row.id} className="border-b border-zinc-900 last:border-0">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.productionItemId)}
                      onChange={() => toggle(row.productionItemId)}
                      aria-label={`Select ${row.name}`}
                      className="size-4"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-zinc-300">{kindLabels[row.kind] ?? row.kind}</td>
                  <td className="px-4 py-3">
                    <span className={row.active ? "text-emerald-400" : "text-zinc-500"}>
                      {row.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-amber-300">Needs recipe</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SummaryCard({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className={warning ? "border border-amber-900 bg-amber-950/20 p-3" : "border border-zinc-800 bg-zinc-950 p-3"}>
      <div className={warning ? "text-xs uppercase text-amber-500" : "text-xs uppercase text-zinc-500"}>{label}</div>
      <div className={warning ? "mt-1 text-xl font-bold text-amber-300" : "mt-1 text-xl font-bold"}>{value}</div>
    </div>
  );
}
