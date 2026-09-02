"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import SecretAIImportBox from "@/components/SecretAIImportBox/SecretAIImportBox";
import type {
  ReconciliationDashboard,
  ReconciliationDraftRow,
} from "@/lib/cookbook-v2/reconciliation-data";
import {
  createRecipePacketSchema,
  packetCurrentValues,
  SECRET_AI_PACKET_SIZE,
  type SecretAIRecipeRequest,
  type SecretAIRecipeResult,
} from "@/lib/cookbook-v2/secret-ai-batch";

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
  jobs?: Array<{
    id: string;
    productionItemId: string;
    input: {
      production_item?: { name?: string; kind?: string };
      sources?: unknown[];
    };
  }>;
};

type BatchStatus = {
  id: string;
  name: string;
  status: string;
  requestedCount: number;
  counts: Record<string, number>;
  jobs: Array<{
    id: string;
    status: string;
    productionItemId: string;
    input: {
      production_item?: { name?: string; kind?: string };
      sources?: unknown[];
    };
  }>;
};

export default function ReconciliationDashboardV2({
  dashboard,
}: {
  dashboard: ReconciliationDashboard;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<"active" | "all">("active");
  const [search, setSearch] = useState("");
  const [batchName, setBatchName] = useState("Production reconciliation batch");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [batches, setBatches] = useState<BatchStatus[]>([]);
  const [drafts, setDrafts] = useState(dashboard.drafts);
  const [activeBatch, setActiveBatch] = useState<{
    id: string;
    name: string;
    packets: SecretAIRecipeRequest[][];
    completedPackets: Set<number>;
  } | null>(null);

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

  useEffect(() => {
    void loadBatches().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Batch status could not be loaded.");
    });
  }, []);

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
      const requests = (result.jobs ?? []).map((job) => ({
        jobId: job.id,
        productionItemId: job.productionItemId,
        name: job.input.production_item?.name ?? "Unnamed production item",
        kind: job.input.production_item?.kind ?? "other",
        sources: job.input.sources ?? [],
      }));
      const packets = Array.from(
        { length: Math.ceil(requests.length / SECRET_AI_PACKET_SIZE) },
        (_, index) => requests.slice(index * SECRET_AI_PACKET_SIZE, (index + 1) * SECRET_AI_PACKET_SIZE),
      );
      setActiveBatch({
        id: result.batchId ?? "",
        name: batchName,
        packets,
        completedPackets: new Set(),
      });
      setMessage(
        `${result.jobCount ?? 0} recipes prepared as ${packets.length} Secret AI+ ` +
          `${packets.length === 1 ? "packet" : "packets"}. Copy, ask ChatGPT, and paste each result below.`,
      );
      await loadBatches();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function importPacket(packetIndex: number, values: Record<string, unknown>) {
    if (!activeBatch) throw new Error("The batch is no longer active.");
    const recipes = values.recipes as SecretAIRecipeResult[];
    const response = await fetch(`/api/reconciliation/batches/${activeBatch.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipes }),
    });
    const result = (await response.json()) as { importedJobs?: number; importedComponents?: number; error?: string };
    if (!response.ok) throw new Error(result.error ?? "Packet could not be imported.");
    setActiveBatch((current) => {
      if (!current) return current;
      const completedPackets = new Set(current.completedPackets);
      completedPackets.add(packetIndex);
      return { ...current, completedPackets };
    });
    setMessage(
      `Imported ${result.importedJobs ?? recipes.length} recipe drafts and ` +
        `${result.importedComponents ?? 0} inline component drafts atomically.`,
    );
    await loadBatches();
    router.refresh();
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

  function resumeBatch(batch: BatchStatus) {
    const requests = batch.jobs
      .filter((job) => ["queued", "failed", "needs_input"].includes(job.status))
      .map((job) => ({
        jobId: job.id,
        productionItemId: job.productionItemId,
        name: job.input.production_item?.name ?? "Unnamed production item",
        kind: job.input.production_item?.kind ?? "other",
        sources: job.input.sources ?? [],
      }));
    const packets = Array.from(
      { length: Math.ceil(requests.length / SECRET_AI_PACKET_SIZE) },
      (_, index) => requests.slice(index * SECRET_AI_PACKET_SIZE, (index + 1) * SECRET_AI_PACKET_SIZE),
    );
    setActiveBatch({ id: batch.id, name: batch.name, packets, completedPackets: new Set() });
    setMessage(`Resumed ${requests.length} recipes in ${packets.length} Secret AI+ ${packets.length === 1 ? "packet" : "packets"}.`);
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
        <SummaryCard
          label="Drafts to review"
          value={drafts.filter((draft) => draft.reviewBucket !== "ready").length}
        />
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
                {batch.jobs.some((job) => ["queued", "failed", "needs_input"].includes(job.status)) && (
                  <button
                    type="button"
                    onClick={() => resumeBatch(batch)}
                    className="mt-3 border border-blue-700 px-3 py-1 text-xs"
                  >
                    Continue Secret AI+
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {activeBatch && (
        <section className="mt-6 border border-blue-900 bg-blue-950/10 p-4">
          <h2 className="text-lg font-semibold">Secret AI+ · {activeBatch.name}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            This is one logical batch split into response-sized packets. Each successful paste creates all
            parent and inline component drafts together; it does not click through the old recipe form.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {activeBatch.packets.map((packet, packetIndex) => {
              const complete = activeBatch.completedPackets.has(packetIndex);
              return (
                <div key={packetIndex} className="border border-zinc-800 bg-black p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">Packet {packetIndex + 1} of {activeBatch.packets.length}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {packet.map((request) => request.name).join(" · ")}
                      </div>
                    </div>
                    {complete ? (
                      <span className="text-sm text-emerald-400">Imported</span>
                    ) : (
                      <SecretAIImportBox
                        formSchema={createRecipePacketSchema(packet.map((request) => request.jobId))}
                        currentValues={packetCurrentValues(packet)}
                        onImport={(values) => importPacket(packetIndex, values)}
                        successMessage="Packet imported into the fast review queue."
                        closeAfterImport
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <FastReviewWorkspace drafts={drafts} setDrafts={setDrafts} setMessage={setMessage} />

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Reconciliation candidates</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Select up to 100 items for one isolated Secret AI+ batch.
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

type ReviewStage = "unreviewed" | "needs_classification" | "minor" | "major" | "ready";

function FastReviewWorkspace({
  drafts,
  setDrafts,
  setMessage,
}: {
  drafts: ReconciliationDraftRow[];
  setDrafts: React.Dispatch<React.SetStateAction<ReconciliationDraftRow[]>>;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [stage, setStage] = useState<ReviewStage>(
    drafts.some((draft) => draft.reviewBucket === "unreviewed") ? "unreviewed" : "needs_classification",
  );
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const stageDrafts = drafts.filter((draft) => draft.reviewBucket === stage);
  const current = stageDrafts[0];

  async function moveDraft(draft: ReconciliationDraftRow, reviewBucket: ReviewStage) {
    setBusyDraftId(draft.id);
    try {
      const response = await fetch(`/api/reconciliation/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewBucket }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Draft could not be moved.");
      setDrafts((existing) =>
        existing.map((item) => item.id === draft.id ? { ...item, reviewBucket } : item),
      );
      setMessage(
        reviewBucket === "ready"
          ? `Kept “${draft.name}” and moved it to Ready.`
          : `Moved “${draft.name}” to ${reviewBucket.replaceAll("_", " ")}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft could not be moved.");
    } finally {
      setBusyDraftId(null);
    }
  }

  const tabs: Array<{ bucket: ReviewStage; label: string }> = [
    { bucket: "unreviewed", label: "Keep / Edit" },
    { bucket: "needs_classification", label: "Classify edits" },
    { bucket: "minor", label: "Minor" },
    { bucket: "major", label: "Major" },
    { bucket: "ready", label: "Ready" },
  ];

  return (
    <section className="mt-6 border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Fast draft review</h2>
          <p className="mt-1 text-sm text-zinc-400">
            First pass: Keep or Edit. Second pass: sort edits into Minor or Major.
          </p>
        </div>
        <div className="text-sm text-zinc-400">{drafts.length} reviewable drafts</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const count = drafts.filter((draft) => draft.reviewBucket === tab.bucket).length;
          return (
            <button
              key={tab.bucket}
              type="button"
              onClick={() => setStage(tab.bucket)}
              className={stage === tab.bucket ? "border border-blue-500 bg-blue-950/30 px-3 py-2 text-sm" : "border border-zinc-700 px-3 py-2 text-sm text-zinc-300"}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {!current ? (
        <p className="mt-4 border border-zinc-800 p-4 text-sm text-emerald-400">
          Nothing in this pile.
        </p>
      ) : (
        <DraftReviewCard
          draft={current}
          position={1}
          total={stageDrafts.length}
          busy={busyDraftId === current.id}
          stage={stage}
          onMove={(bucket) => moveDraft(current, bucket)}
        />
      )}
    </section>
  );
}

function DraftReviewCard({
  draft,
  position,
  total,
  busy,
  stage,
  onMove,
}: {
  draft: ReconciliationDraftRow;
  position: number;
  total: number;
  busy: boolean;
  stage: ReviewStage;
  onMove: (bucket: ReviewStage) => void;
}) {
  const items = Array.isArray(draft.draftPayload.items)
    ? draft.draftPayload.items as Array<Record<string, unknown>>
    : [];
  const steps = Array.isArray(draft.draftPayload.steps)
    ? draft.draftPayload.steps as Array<Record<string, unknown>>
    : [];

  return (
    <article className="mt-4 border border-zinc-700 bg-black p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-zinc-500">{position} of {total}</div>
          <h3 className="mt-1 text-xl font-semibold">{draft.name}</h3>
          <div className="mt-1 text-sm capitalize text-zinc-400">
            {draft.inlineComponent ? "Inline component" : "Production recipe"} · {draft.recipeCategory} · {draft.itemCount} items · {draft.stepCount} steps
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {stage === "unreviewed" && (
            <>
              <button disabled={busy} onClick={() => onMove("ready")} className="border border-emerald-600 px-5 py-2 font-semibold text-emerald-300 disabled:opacity-40">Keep</button>
              <button disabled={busy} onClick={() => onMove("needs_classification")} className="border border-amber-600 px-5 py-2 font-semibold text-amber-300 disabled:opacity-40">Edit</button>
            </>
          )}
          {stage === "needs_classification" && (
            <>
              <button disabled={busy} onClick={() => onMove("minor")} className="border border-amber-700 px-5 py-2 font-semibold text-amber-300 disabled:opacity-40">Minor</button>
              <button disabled={busy} onClick={() => onMove("major")} className="border border-red-700 px-5 py-2 font-semibold text-red-300 disabled:opacity-40">Major</button>
              <button disabled={busy} onClick={() => onMove("ready")} className="border border-emerald-700 px-3 py-2 text-sm text-emerald-300 disabled:opacity-40">Actually keep</button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-zinc-300">Ingredients and components</h4>
          <div className="mt-2 divide-y divide-zinc-900 border border-zinc-800">
            {items.map((item, index) => (
              <div key={index} className="flex justify-between gap-4 px-3 py-2 text-sm">
                <span>{String(item.proposedName ?? "Unnamed item")}</span>
                <span className="whitespace-nowrap text-zinc-400">{String(item.quantity ?? "")} {String(item.unit ?? "")}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-300">Method</h4>
          <ol className="mt-2 list-decimal space-y-2 border border-zinc-800 px-8 py-3 text-sm text-zinc-300">
            {steps.map((step, index) => <li key={index}>{String(step.instruction ?? "")}</li>)}
          </ol>
        </div>
      </div>
    </article>
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
