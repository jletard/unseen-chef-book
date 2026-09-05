"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ReconciliationDraftRow } from "@/lib/cookbook-v2/reconciliation-data";

export default function DraftTrashControl({ drafts }: { drafts: ReconciliationDraftRow[] }) {
  const router = useRouter();
  const [draftId, setDraftId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = drafts.find((draft) => draft.id === draftId);

  async function trashDraft() {
    if (!selected) return;
    if (!window.confirm(`Trash “${selected.name}”? This removes this draft from review without creating an approved recipe.`)) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/reconciliation/drafts/${selected.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Draft could not be trashed.");
      setDraftId("");
      setMessage(`Trashed “${selected.name}”.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft could not be trashed.");
    } finally {
      setBusy(false);
    }
  }

  if (!drafts.length) return null;

  return (
    <section className="mb-4 border border-red-950 bg-red-950/10 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-64 flex-1 text-sm">
          <span className="mb-1 block text-zinc-400">Trash a review draft</span>
          <select
            value={draftId}
            onChange={(event) => setDraftId(event.target.value)}
            disabled={busy}
            className="w-full border border-zinc-700 bg-black px-3 py-2"
          >
            <option value="">Choose draft…</option>
            {drafts.map((draft) => (
              <option key={draft.id} value={draft.id}>
                {draft.name} · {draft.reviewBucket.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={trashDraft}
          disabled={busy || !selected}
          className="border border-red-700 px-4 py-2 font-semibold text-red-300 disabled:opacity-40"
        >
          {busy ? "Trashing…" : "Trash draft"}
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-amber-300">{message}</p>}
    </section>
  );
}
