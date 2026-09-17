import "server-only";

import { normalizeCookbookName } from "@/lib/cookbook-v2/normalize-name";
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

type MenuItemSourceRow = {
  id: string;
  name: string;
};

async function ensureMenuItemProductionCoverage() {
  const [menuResult, sourceResult] = await Promise.all([
    supabaseAdmin.from("menu_items_v2").select("id, name"),
    supabaseAdmin
      .from("production_item_sources")
      .select("source_id")
      .eq("source_type", "menu_item")
      .neq("mapping_state", "rejected"),
  ]);

  const error = menuResult.error ?? sourceResult.error;
  if (error) {
    throw new Error(`Unable to verify menu-item reconciliation coverage: ${error.message}`);
  }

  const coveredMenuIds = new Set(
    (sourceResult.data ?? [])
      .map((row) => row.source_id ? String(row.source_id) : "")
      .filter(Boolean),
  );

  for (const menuItem of (menuResult.data ?? []) as MenuItemSourceRow[]) {
    if (coveredMenuIds.has(menuItem.id)) continue;

    const normalizedName = normalizeCookbookName(menuItem.name);
    const { data: productionItem, error: productionError } = await supabaseAdmin
      .from("production_items")
      .insert({
        name: menuItem.name,
        normalized_name: normalizedName,
        kind: "menu_item",
        active: true,
        recipe_requirement: "required",
      })
      .select("id")
      .single();

    if (productionError || !productionItem) {
      throw new Error(
        `Could not create production coverage for "${menuItem.name}": ${productionError?.message ?? "unknown error"}`,
      );
    }

    const { error: sourceError } = await supabaseAdmin
      .from("production_item_sources")
      .insert({
        production_item_id: productionItem.id,
        source_type: "menu_item",
        source_id: menuItem.id,
        source_name_snapshot: menuItem.name,
        normalized_source_name: normalizedName,
        mapping_state: "confirmed",
      });

    if (sourceError) {
      // If another request filled the same stable source first, remove the
      // unused duplicate production item and continue.
      if (sourceError.code === "23505") {
        await supabaseAdmin.from("production_items").delete().eq("id", productionItem.id);
        continue;
      }
      throw new Error(
        `Could not attach production coverage for "${menuItem.name}": ${sourceError.message}`,
      );
    }
  }
}

export async function getReconciliationDashboardV2(): Promise<ReconciliationDashboard> {
  // Reconciliation should cover every menu item in the system. Order category
  // and weekly availability are Admin concerns and must never decide whether a
  // recipe belongs in Book.
  await ensureMenuItemProductionCoverage();

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
    const normalizedName = normalizeCookbookName(item.name);
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

  // Do not rely on a historical reconciliation task having been created.
  // Every menu item without recipe knowledge belongs in the queue, regardless
  // of category or whether Admin currently offers it for sale.
  const existingMissingRecipeIds = new Set(
    tasks
      .filter((task) => task.task_type === "missing_recipe")
      .map((task) => task.subject_id),
  );
  const menuProductionItemIds = new Set(
    sources
      .filter(
        (source) =>
          source.source_type === "menu_item" &&
          source.mapping_state === "confirmed" &&
          Boolean(source.source_id),
      )
      .map((source) => String(source.production_item_id)),
  );

  const missingTaskProductionIds: string[] = [];
  for (const productionItemId of menuProductionItemIds) {
    if (
      linkedProductionItemIds.has(productionItemId) ||
      existingMissingRecipeIds.has(productionItemId)
    ) {
      continue;
    }
    missingTaskProductionIds.push(productionItemId);
  }

  // Batch creation is intentionally backed by reconciliation_tasks. If Book
  // discovers a genuinely missing recipe from live menu coverage, persist that
  // task here instead of showing a synthetic candidate that the batch RPC will
  // later reject as "no longer needs a recipe."
  if (missingTaskProductionIds.length) {
    const rows = missingTaskProductionIds.map((productionItemId) => ({
      task_type: "missing_recipe",
      subject_type: "production_item",
      subject_id: productionItemId,
      status: "open",
      priority: 100,
      candidate_payload: {},
    }));
    const { data: insertedTasks, error: insertTaskError } = await supabaseAdmin
      .from("reconciliation_tasks")
      .insert(rows)
      .select("id, task_type, subject_id, status, priority");

    if (insertTaskError && insertTaskError.code !== "23505") {
      throw new Error(
        `Unable to create missing-recipe reconciliation tasks: ${insertTaskError.message}`,
      );
    }

    for (const task of (insertedTasks ?? []) as TaskRow[]) {
      tasks.push(task);
      existingMissingRecipeIds.add(task.subject_id);
    }

    // If another request inserted the task first, load the winners so this
    // request still renders the same authoritative queue.
    const stillMissing = missingTaskProductionIds.filter(
      (productionItemId) => !existingMissingRecipeIds.has(productionItemId),
    );
    if (stillMissing.length) {
      const { data: persistedTasks, error: persistedTaskError } = await supabaseAdmin
        .from("reconciliation_tasks")
        .select("id, task_type, subject_id, status, priority")
        .eq("task_type", "missing_recipe")
        .eq("subject_type", "production_item")
        .in("subject_id", stillMissing)
        .in("status", ["open", "deferred"]);

      if (persistedTaskError) {
        throw new Error(
          `Unable to reload missing-recipe reconciliation tasks: ${persistedTaskError.message}`,
        );
      }
      tasks.push(...((persistedTasks ?? []) as TaskRow[]));
    }
  }

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
