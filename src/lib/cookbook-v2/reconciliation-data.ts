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
  recipe_id: string | null;
  review_bucket: string;
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
        .select("recipe_id, review_bucket")
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
  };
}
