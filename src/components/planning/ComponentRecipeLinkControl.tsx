"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type { ReconciliationDraftRow } from "@/lib/cookbook-v2/reconciliation-data";

type ApprovedRecipeOption = {
  id: string;
  name: string;
  versionId: string;
};

const stageLabels: Record<string, string> = {
  "Keep / Edit": "unreviewed",
  "Classify edits": "needs_classification",
  Minor: "minor",
  Major: "major",
  Ready: "ready",
};

export default function ComponentRecipeLinkControl({ drafts }: { drafts: ReconciliationDraftRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [currentDraft, setCurrentDraft] = useState<ReconciliationDraftRow | null>(null);
  const [approvedRecipes, setApprovedRecipes] = useState<ApprovedRecipeOption[]>([]);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");

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
        button.className.includes("border-blue-500") &&
        Object.keys(stageLabels).some((label) => button.textContent?.trim().startsWith(label)),
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

      setTarget(article);
      setCurrentDraft((existing) => existing?.id === draft.id && existing.draftPayload === draft.draftPayload ? existing : draft);
    }

    locateCurrentCard();
    const observer = new MutationObserver(locateCurrentCard);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => observer.disconnect();
  }, [drafts]);

  useEffect(() => {
    if (!currentDraft) return;
    const items = Array.isArray(currentDraft.draftPayload.items)
      ? currentDraft.draftPayload.items as Array<Record<string, unknown>>
      : [];
    if (!items.some((item) => item.kind === "recipe")) return;

    let cancelled = false;
    void fetch("/api/reconciliation/finalize", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { approvedRecipeOptions?: ApprovedRecipeOption[] };
        if (!response.ok) throw new Error("Could not load approved recipes.");
        if (!cancelled) setApprovedRecipes(result.approvedRecipeOptions ?? []);
      })
      .catch(() => {
        if (!cancelled) setApprovedRecipes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentDraft?.id]);

  const componentItems = useMemo(() => {
    if (!currentDraft) return [];
    const items = Array.isArray(currentDraft.draftPayload.items)
      ? currentDraft.draftPayload.items as Array<Record<string, unknown>>
      : [];
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.kind === "recipe");
  }, [currentDraft]);

  const readyDrafts = useMemo(
    () => drafts
      .filter((draft) => draft.id !== currentDraft?.id && draft.reviewBucket === "ready")
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name)),
    [drafts, currentDraft?.id],
  );

  async function connect(itemIndex: number) {
    if (!currentDraft || busyIndex !== null) return;
    const choice = choices[itemIndex];
    if (!choice) return;

    const payload = structuredClone(currentDraft.draftPayload);
    const items = Array.isArray(payload.items) ? payload.items as Array<Record<string, unknown>> : [];
    const item = items[itemIndex];
    if (!item || item.kind !== "recipe") return;

    if (choice.startsWith("draft:")) {
      const draftId = choice.slice("draft:".length);
      const linkedDraft = drafts.find((draft) => draft.id === draftId);
      if (!linkedDraft) return;
      item.proposedName = linkedDraft.name;
      item.nestedDraftId = linkedDraft.id;
      delete item.recipeId;
      delete item.recipeVersionId;
    } else if (choice.startsWith("recipe:")) {
      const recipeId = choice.slice("recipe:".length);
      const linkedRecipe = approvedRecipes.find((recipe) => recipe.id === recipeId);
      if (!linkedRecipe) return;
      item.proposedName = linkedRecipe.name;
      item.recipeId = linkedRecipe.id;
      item.recipeVersionId = linkedRecipe.versionId;
      delete item.nestedDraftId;
    }

    setBusyIndex(itemIndex);
    setMessage("");
    try {
      const response = await fetch(`/api/reconciliation/drafts/${currentDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftPayload: payload }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Component link could not be saved.");
      setMessage(`Connected ${String(item.proposedName ?? "component")}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Component link could not be saved.");
    } finally {
      setBusyIndex(null);
    }
  }

  if (!target || !currentDraft || componentItems.length === 0) return null;

  return createPortal(
    <section className="mx-3 mb-4 border border-blue-900 bg-blue-950/10 p-3 sm:mx-4">
      <div className="font-medium text-blue-200">Component recipe links</div>
      <p className="mt-1 text-xs text-zinc-400">
        Explicitly connect each component line to the Ready draft or approved recipe it should use.
      </p>
      <div className="mt-3 space-y-3">
        {componentItems.map(({ item, index }) => {
          const nestedDraftId = typeof item.nestedDraftId === "string" ? item.nestedDraftId : "";
          const recipeId = typeof item.recipeId === "string" ? item.recipeId : "";
          const existingValue = nestedDraftId ? `draft:${nestedDraftId}` : recipeId ? `recipe:${recipeId}` : "";
          const value = choices[index] ?? existingValue;
          return (
            <div key={String(item.id ?? index)} className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_minmax(18rem,2fr)_auto] sm:items-center">
              <div>
                <div className="font-medium">{String(item.proposedName ?? "Unnamed component")}</div>
                <div className="text-xs text-zinc-500">
                  {nestedDraftId ? "Linked to review draft" : recipeId ? "Linked to approved recipe" : "Not explicitly linked"}
                </div>
              </div>
              <select
                value={value}
                onChange={(event) => setChoices((current) => ({ ...current, [index]: event.target.value }))}
                disabled={busyIndex !== null}
                className="min-w-0 border border-zinc-700 bg-black px-3 py-2 text-white disabled:opacity-40"
              >
                <option value="">Choose component recipe…</option>
                {readyDrafts.length > 0 && (
                  <optgroup label="Ready drafts">
                    {readyDrafts.map((draft) => (
                      <option key={`draft:${draft.id}`} value={`draft:${draft.id}`}>{draft.name}</option>
                    ))}
                  </optgroup>
                )}
                {approvedRecipes.length > 0 && (
                  <optgroup label="Approved recipes">
                    {approvedRecipes.map((recipe) => (
                      <option key={`recipe:${recipe.id}`} value={`recipe:${recipe.id}`}>{recipe.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={() => connect(index)}
                disabled={busyIndex !== null || !value || value === existingValue}
                className="border border-blue-700 px-3 py-2 font-medium text-blue-200 disabled:opacity-40"
              >
                {busyIndex === index ? "Connecting…" : existingValue ? "Change link" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
      {message && <p className="mt-3 text-sm text-amber-300">{message}</p>}
    </section>,
    target,
  );
}
