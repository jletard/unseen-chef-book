"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type { ReconciliationDraftRow } from "@/lib/cookbook-v2/reconciliation-data";

const stageLabels: Record<string, string> = {
  "Keep / Edit": "unreviewed",
  "Classify edits": "needs_classification",
  Minor: "minor",
  Major: "major",
  Ready: "ready",
};

export default function DraftTrashControl({ drafts }: { drafts: ReconciliationDraftRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [currentDraft, setCurrentDraft] = useState<ReconciliationDraftRow | null>(null);

  useEffect(() => {
    function locateCurrentCard() {
      const headings = Array.from(document.querySelectorAll("h2"));
      const workspaceHeading = headings.find((heading) => heading.textContent?.trim() === "Fast draft review");
      const workspace = workspaceHeading?.closest("section");
      if (!workspace) {
        setTarget(null);
        setCurrentDraft(null);
        return;
      }

      const article = workspace.querySelector("article");
      const cardHeading = article?.querySelector("h3");
      const positionText = article?.querySelector(".text-xs.uppercase.text-zinc-500")?.textContent ?? "";
      const position = Number(positionText.match(/^(\d+)\s+of\s+\d+$/i)?.[1] ?? 0);
      const activeTab = Array.from(workspace.querySelectorAll("button")).find((button) =>
        button.className.includes("border-blue-500") && Object.keys(stageLabels).some((label) => button.textContent?.trim().startsWith(label)),
      );
      const activeLabel = Object.keys(stageLabels).find((label) => activeTab?.textContent?.trim().startsWith(label));
      const stage = activeLabel ? stageLabels[activeLabel] : null;
      const stageDrafts = stage ? drafts.filter((draft) => draft.reviewBucket === stage) : [];
      const draft = position > 0 ? stageDrafts[position - 1] : undefined;

      if (!article || !cardHeading || !draft || draft.name !== cardHeading.textContent?.trim()) {
        setTarget(null);
        setCurrentDraft(null);
        return;
      }

      const controls = article.firstElementChild?.lastElementChild;
      setTarget(controls instanceof HTMLElement ? controls : null);
      setCurrentDraft(draft);
    }

    locateCurrentCard();
    const observer = new MutationObserver(locateCurrentCard);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, [drafts]);

  async function trashDraft() {
    if (!currentDraft || busy) return;
    if (!window.confirm(`Delete “${currentDraft.name}” from the review queue? This will not create an approved recipe.`)) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/reconciliation/drafts/${currentDraft.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Draft could not be deleted.");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Draft could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  if (!target || !currentDraft) return null;

  return createPortal(
    <button
      type="button"
      onClick={trashDraft}
      disabled={busy}
      className="border border-red-700 px-4 py-2 text-sm font-semibold text-red-300 disabled:opacity-40"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>,
    target,
  );
}
