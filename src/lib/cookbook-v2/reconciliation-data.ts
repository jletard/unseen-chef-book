import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type ReconciliationQueueRow = {
  id: string;
  productionItemId: string;
  name: string;
  kind: string;
  active: boolean;
  priority: number;
  taskType: string;
  taskStatus: string;
  reviewBucket: string | null;
};

export type ReconciliationDashboard = {
  totalProductionItems: number;
  missingRecipes: number;
  openIdentityDecisions: number;
  draftCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  queue: ReconciliationQueueRow[];
  drafts: ReconciliationDraftRow[];
};

export type ReconciliationDraftRow = {
  id: string;
  draftState: string;
  reviewBucket: string;
  name: string;
  recipeCategory: string;
  itemCount: number;
  stepCount: number;
  inlineComponent: boolean;
  bulkProtein: boolean;
  draftPayload: Record<string, unknown>;
};

type ProductionItemRow = {
  id: string;
  name: string;
  kind: string;
  active: boolean;
};

type TaskRow = {
  id: string;
  task_type: string;
  subject_id: string;
  status: string;
  priority: number;
};

type DraftRow = {
  id: string;
  recipe_id: string | null;
  draft_state: string;
  review_bucket: string;
  draft_payload: Record<string, unknown>;
  generation_metadata: Record<string, unknown> | null;
  source_payload: {
    production_item?: { kind?: string };
  } | null;
};

type SourceRow = { source_type: string };

export async function getReconciliationDashboardV2(): Promise<ReconciliationDashboard> {
  const [productionResult, taskResult, draftResult, sourceResult] =
    await Promise.all([
      supabaseAdmin
        .from("production_items")
        .select("id, name, kind, active")
        .order("active", { ascending: false })
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("reconciliation_tasks")
        .select("id, task_type, subject_id, status, priority")
        .in("status", ["open", "deferred"])
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("recipe_drafts")
        .select("id, recipe_id, draft_state, review_bucket, draft_payload, generation_metadata, source_payload")
        .neq("draft_state", "archived"),
      supabaseAdmin.from("production_item_sources").select("source_type"),
    ]);

  const error =
    productionResult.error ??
    taskResult.error ??
    draftResult.error ??
    sourceResult.error;
  if (error) {
    throw new Error(`Unable to load reconciliation workspace: ${error.message}`);
  }

  const productionItems = (productionResult.data ?? []) as ProductionItemRow[];
  const tasks = (taskResult.data ?? []) as TaskRow[];
  const drafts = (draftResult.data ?? []) as DraftRow[];
  const sources = (sourceResult.data ?? []) as SourceRow[];
  const productionById = new Map(productionItems.map((item) => [item.id, item]));
  const draftByRecipeId = new Map(
    drafts
      .filter((draft) => draft.recipe_id)
      .map((draft) => [draft.recipe_id as string, draft.review_bucket]),
  );

  const draftCounts = drafts.reduce<Record<string, number>>((counts, draft) => {
    counts[draft.review_bucket] = (counts[draft.review_bucket] ?? 0) + 1;
    return counts;
  }, {});
  const reconciliationDrafts = drafts
    .filter((draft) => draft.draft_state === "ready_for_review")
    .map<ReconciliationDraftRow>((draft) => {
      const payload = draft.draft_payload ?? {};
      return {
        id: draft.id,
        draftState: draft.draft_state,
        reviewBucket: draft.review_bucket,
        name: typeof payload.name === "string" ? payload.name : "Unnamed recipe",
        recipeCategory:
          typeof payload.recipeCategory === "string" ? payload.recipeCategory : "other",
        itemCount: Array.isArray(payload.items) ? payload.items.length : 0,
        stepCount: Array.isArray(payload.steps) ? payload.steps.length : 0,
        inlineComponent: draft.generation_metadata?.inline_component === true,
        bulkProtein: draft.source_payload?.production_item?.kind === "bulk_protein",
        draftPayload: payload,
      };
    })
    .sort((left, right) => {
      if (left.reviewBucket !== right.reviewBucket) {
        return left.reviewBucket.localeCompare(right.reviewBucket);
      }
      if (left.inlineComponent !== right.inlineComponent) {
        return left.inlineComponent ? 1 : -1;
      }
      return left.name.localeCompare(right.name);
    });
  const sourceCounts = sources.reduce<Record<string, number>>((counts, source) => {
    counts[source.source_type] = (counts[source.source_type] ?? 0) + 1;
    return counts;
  }, {});

  const queue = tasks.flatMap<ReconciliationQueueRow>((task) => {
    const productionItem = productionById.get(task.subject_id);
    if (!productionItem) return [];

    return [
      {
        id: task.id,
        productionItemId: productionItem.id,
        name: productionItem.name,
        kind: productionItem.kind,
        active: productionItem.active,
        priority: task.priority,
        taskType: task.task_type,
        taskStatus: task.status,
        reviewBucket: draftByRecipeId.get(task.subject_id) ?? null,
      },
    ];
  });

  return {
    totalProductionItems: productionItems.length,
    missingRecipes: tasks.filter((task) => task.task_type === "missing_recipe").length,
    openIdentityDecisions: tasks.filter(
      (task) => task.task_type === "source_mapping" || task.task_type.endsWith("_match"),
    ).length,
    draftCounts,
    sourceCounts,
    queue,
    drafts: reconciliationDrafts,
  };
}
