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

type SourceRow = {
  production_item_id: string;
  source_type: string;
  source_id: string | null;
  mapping_state: string;
};

export async function getReconciliationDashboardV2(): Promise<ReconciliationDashboard> {
  const [
    productionResult,
    taskResult,
    draftResult,
    sourceResult,
    recipeLinkResult,
    menuRecipeLinkResult,
    approvedRecipeResult,
  ] = await Promise.all([
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
      supabaseAdmin
        .from("production_item_sources")
        .select("production_item_id, source_type, source_id, mapping_state"),
      supabaseAdmin
        .from("production_item_recipe_links")
        .select("production_item_id")
        .eq("role", "main")
        .eq("active", true),
      supabaseAdmin
        .from("menu_item_recipe_links")
        .select("menu_item_id")
        .eq("role", "main"),
      supabaseAdmin
        .from("recipes")
        .select("normalized_name")
        .is("retired_at", null)
        .not("current_approved_version_id", "is", null),
    ]);

  const error =
    productionResult.error ??
    taskResult.error ??
    draftResult.error ??
    sourceResult.error ??
    recipeLinkResult.error ??
    menuRecipeLinkResult.error ??
    approvedRecipeResult.error;
  if (error) {
    throw new Error(`Unable to load reconciliation workspace: ${error.message}`);
  }

  const productionItems = (productionResult.data ?? []) as ProductionItemRow[];
  const sources = (sourceResult.data ?? []) as SourceRow[];
  const linkedProductionItemIds = new Set(
    (recipeLinkResult.data ?? []).map((row) => String(row.production_item_id)),
  );

  // Older Book screens may have linked the menu item directly rather than
  // creating a production-item recipe link. Count that as complete too.
  const directlyLinkedMenuItemIds = new Set(
    (menuRecipeLinkResult.data ?? []).map((row) => String(row.menu_item_id)),
  );
  for (const source of sources) {
    if (
      source.source_type === "menu_item" &&
      source.mapping_state === "confirmed" &&
      source.source_id &&
      directlyLinkedMenuItemIds.has(String(source.source_id))
    ) {
      linkedProductionItemIds.add(String(source.production_item_id));
    }
  }

  // A few reconciled recipes predate both link systems. A unique exact approved
  // recipe name is enough to keep the reconciliation queue from asking for the
  // same recipe again; the planning/shopping code can still surface a real
  // relationship problem if one exists.
  const approvedRecipeNameCounts = new Map<string, number>();
  for (const row of approvedRecipeResult.data ?? []) {
    const name = String(row.normalized_name ?? "").trim();
    if (!name) continue;
    approvedRecipeNameCounts.set(name, (approvedRecipeNameCounts.get(name) ?? 0) + 1);
  }
  for (const item of productionItems) {
    const normalizedName = item.name.trim().toLowerCase().replace(/\s+/gu, " ");
    if ((approvedRecipeNameCounts.get(normalizedName) ?? 0) === 1) {
      linkedProductionItemIds.add(item.id);
    }
  }

  // Old open missing-recipe tasks can outlive the recipe relationship they
  // originally requested. Live recipe knowledge is authoritative.
  const tasks = ((taskResult.data ?? []) as TaskRow[]).filter(
    (task) =>
      task.task_type !== "missing_recipe" ||
      !linkedProductionItemIds.has(task.subject_id),
  );
  const drafts = (draftResult.data ?? []) as DraftRow[];
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
        bulkProtein:
          draft.generation_metadata?.inline_component !== true &&
          draft.source_payload?.production_item?.kind === "bulk_protein",
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
