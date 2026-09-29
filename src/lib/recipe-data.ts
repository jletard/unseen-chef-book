import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  IngredientComponentRecord,
  IngredientRecord,
  MenuItemRecipeLink,
  RecipeRecord,
} from "@/types/cookbook-data";

type RecipeRow = {
  id: string;
  name: string;
  recipe_type: string;
  status: "draft" | "complete" | "inactive";
  yield_kind: string | null;
  base_yield: number | null;
  yield_unit: string | null;
  minimum_batch: number | null;
  notes: string | null;
};

export async function getIngredients(): Promise<IngredientRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("ingredients")
    .select("id, name, measurement_kind, ingredient_kind, label_name, ingredient_statement, label_review_status, active, exclude_from_shopping, notes")
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Failed to load ingredients: " + error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    measurementKind: row.measurement_kind as IngredientRecord["measurementKind"],
    ingredientKind: row.ingredient_kind === "compound" ? "compound" : "simple",
    labelName: String(row.label_name || row.name),
    ingredientStatement: String(row.ingredient_statement || row.label_name || row.name),
    labelReviewStatus: row.label_review_status === "confirmed" ? "confirmed" : "unreviewed",
    active: Boolean(row.active),
    excludeFromShopping: Boolean(row.exclude_from_shopping),
    notes: row.notes ? String(row.notes) : null,
  }));
}

export async function getIngredientComponents(): Promise<IngredientComponentRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("ingredient_components")
    .select("id, parent_ingredient_id, child_ingredient_id, sort_order, quantity, unit, percentage, source_text")
    .order("parent_ingredient_id", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error("Failed to load ingredient components: " + error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    parentIngredientId: String(row.parent_ingredient_id),
    childIngredientId: String(row.child_ingredient_id),
    sortOrder: Number(row.sort_order ?? 0),
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit ? String(row.unit) : null,
    percentage: row.percentage === null ? null : Number(row.percentage),
    sourceText: row.source_text ? String(row.source_text) : null,
  }));
}

export async function getRecipes(): Promise<RecipeRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("recipes")
    .select(
      "id, name, recipe_type, status, yield_kind, base_yield, yield_unit, minimum_batch, notes",
    )
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Failed to load recipes: " + error.message);
  }

  return ((data ?? []) as RecipeRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    recipeType: row.recipe_type,
    status: row.status,
    yieldKind: row.yield_kind,
    baseYield: row.base_yield === null ? null : Number(row.base_yield),
    yieldUnit: row.yield_unit,
    minimumBatch:
      row.minimum_batch === null ? null : Number(row.minimum_batch),
    notes: row.notes,
  }));
}

export async function getMenuItemRecipeLinks(): Promise<
  MenuItemRecipeLink[]
> {
  const [legacyResult, sourceResult, productionLinkResult] = await Promise.all([
    supabaseAdmin
      .from("menu_item_recipe_links")
      .select("id, menu_item_id, recipe_id, role, sort_order")
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("production_item_sources")
      .select("production_item_id, source_id")
      .eq("source_type", "menu_item")
      .eq("mapping_state", "confirmed"),
    supabaseAdmin
      .from("production_item_recipe_links")
      .select("id, production_item_id, recipe_id, role, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const error =
    legacyResult.error ?? sourceResult.error ?? productionLinkResult.error;
  if (error) {
    throw new Error("Failed to load menu recipe links: " + error.message);
  }

  // Reconciliation writes the canonical production-item recipe relationship.
  // Menu Items should reflect that automatically rather than requiring the same
  // recipe to be linked a second time in the older menu_item_recipe_links table.
  const menuIdsByProductionId = new Map<string, string[]>();
  for (const source of sourceResult.data ?? []) {
    if (!source.source_id) continue;
    const productionItemId = String(source.production_item_id);
    const menuIds = menuIdsByProductionId.get(productionItemId) ?? [];
    menuIds.push(String(source.source_id));
    menuIdsByProductionId.set(productionItemId, menuIds);
  }

  const merged = new Map<string, MenuItemRecipeLink>();

  for (const row of productionLinkResult.data ?? []) {
    const menuIds = menuIdsByProductionId.get(String(row.production_item_id)) ?? [];
    for (const menuItemId of menuIds) {
      const link: MenuItemRecipeLink = {
        id: `production:${String(row.id)}:${menuItemId}`,
        menuItemId,
        recipeId: String(row.recipe_id),
        role: row.role as MenuItemRecipeLink["role"],
        sortOrder: Number(row.sort_order ?? 0),
      };
      merged.set(`${menuItemId}|${link.recipeId}|${link.role}`, link);
    }
  }

  // Preserve older direct links only where reconciliation has not already
  // supplied the same relationship.
  for (const row of legacyResult.data ?? []) {
    const link: MenuItemRecipeLink = {
      id: String(row.id),
      menuItemId: String(row.menu_item_id),
      recipeId: String(row.recipe_id),
      role: row.role as MenuItemRecipeLink["role"],
      sortOrder: Number(row.sort_order ?? 0),
    };
    const key = `${link.menuItemId}|${link.recipeId}|${link.role}`;
    if (!merged.has(key)) merged.set(key, link);
  }

  return Array.from(merged.values()).sort(
    (left, right) =>
      left.menuItemId.localeCompare(right.menuItemId) ||
      left.sortOrder - right.sortOrder,
  );
}

type RecipeItemRow = {
  id: string;
  recipe_id: string;
  item_type: "ingredient" | "component";
  ingredient_id: string | null;
  component_recipe_id: string | null;
  quantity: number;
  unit: string;
  preparation_note: string | null;
  sort_order: number;
};

export async function getRecipeById(
  id: string,
): Promise<RecipeRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("recipes")
    .select(
      "id, name, recipe_type, status, yield_kind, base_yield, yield_unit, minimum_batch, notes",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load recipe: " + error.message);
  }

  if (!data) return null;

  const row = data as RecipeRow;

  return {
    id: row.id,
    name: row.name,
    recipeType: row.recipe_type,
    status: row.status,
    yieldKind: row.yield_kind,
    baseYield: row.base_yield === null ? null : Number(row.base_yield),
    yieldUnit: row.yield_unit,
    minimumBatch:
      row.minimum_batch === null ? null : Number(row.minimum_batch),
    notes: row.notes,
  };
}

export async function getRecipeItems(
  recipeId: string,
): Promise<import("@/types/cookbook-data").RecipeItemRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("recipe_items")
    .select(
      "id, recipe_id, item_type, ingredient_id, component_recipe_id, quantity, unit, preparation_note, sort_order",
    )
    .eq("recipe_id", recipeId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error("Failed to load recipe items: " + error.message);
  }

  const rows = (data ?? []) as RecipeItemRow[];
  const ingredientIds = Array.from(
    new Set(
      rows
        .map((row) => row.ingredient_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const componentRecipeIds = Array.from(
    new Set(
      rows
        .map((row) => row.component_recipe_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [ingredientResult, recipeResult] = await Promise.all([
    ingredientIds.length
      ? supabaseAdmin.from("ingredients").select("id, name").in("id", ingredientIds)
      : Promise.resolve({ data: [], error: null }),
    componentRecipeIds.length
      ? supabaseAdmin.from("recipes").select("id, name").in("id", componentRecipeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lookupError = ingredientResult.error ?? recipeResult.error;
  if (lookupError) {
    throw new Error("Failed to load recipe item names: " + lookupError.message);
  }

  const ingredientNames = new Map(
    (ingredientResult.data ?? []).map((ingredient) => [
      String(ingredient.id),
      String(ingredient.name),
    ]),
  );
  const recipeNames = new Map(
    (recipeResult.data ?? []).map((recipe) => [
      String(recipe.id),
      String(recipe.name),
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    recipeId: row.recipe_id,
    itemType: row.item_type,
    ingredientId: row.ingredient_id,
    componentRecipeId: row.component_recipe_id,
    quantity: Number(row.quantity),
    unit: row.unit,
    preparationNote: row.preparation_note,
    sortOrder: Number(row.sort_order),
    displayName:
      row.item_type === "ingredient"
        ? ingredientNames.get(row.ingredient_id ?? "") ?? "Unknown ingredient"
        : recipeNames.get(row.component_recipe_id ?? "") ?? "Unknown component",
  }));
}

export async function getRecipeSteps(
  recipeId: string,
): Promise<import("@/types/cookbook-data").RecipeStepRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("recipe_steps")
    .select("id, recipe_id, step_number, instruction")
    .eq("recipe_id", recipeId)
    .order("step_number", { ascending: true });

  if (error) {
    throw new Error("Failed to load recipe steps: " + error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    recipeId: String(row.recipe_id),
    stepNumber: Number(row.step_number),
    instruction: String(row.instruction),
  }));
}


export type ApprovedRecipeEditorData = {
  recipeId: string;
  versionId: string;
  name: string;
  recipeType: string;
  yieldKind: string;
  baseYield: number;
  yieldUnit: string;
  minimumBatchQuantity: number;
  minimumBatchUnit: string;
  portionQuantity: number | null;
  portionUnit: string | null;
  chefNotes: string;
  items: Array<{
    id: string;
    kind: "ingredient" | "recipe";
    sourceId: string;
    name: string;
    quantity: number;
    unit: string;
    preparationNote: string;
  }>;
  steps: Array<{ id: string; instruction: string }>;
  ingredientOptions: Array<{ id: string; name: string; measurementKind: "liquid" | "solid" | "countable" }>;
  componentOptions: Array<{ id: string; name: string; currentApprovedVersionId: string }>;
};

export async function getApprovedRecipeEditorData(
  recipeId: string,
  options: { includeOptions?: boolean } = {},
): Promise<ApprovedRecipeEditorData | null> {
  const includeOptions = options.includeOptions ?? true;
  const { data: recipe, error: recipeError } = await supabaseAdmin
    .from("recipes")
    .select("id, name, recipe_type, current_approved_version_id")
    .eq("id", recipeId)
    .maybeSingle();

  if (recipeError) {
    throw new Error("Failed to load approved recipe identity: " + recipeError.message);
  }
  if (!recipe?.current_approved_version_id) return null;

  const versionId = String(recipe.current_approved_version_id);
  const [versionResult, itemResult, stepResult] = await Promise.all([
    supabaseAdmin
      .from("recipe_versions")
      .select("id, yield_kind, base_yield, yield_unit, minimum_batch_quantity, minimum_batch_unit, portion_quantity, portion_unit, chef_notes")
      .eq("id", versionId)
      .maybeSingle(),
    supabaseAdmin
      .from("recipe_version_items")
      .select("id, item_kind, ingredient_id, dependency_recipe_version_id, quantity, unit, preparation_note, sort_order")
      .eq("recipe_version_id", versionId)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("recipe_version_steps")
      .select("id, instruction, step_number")
      .eq("recipe_version_id", versionId)
      .order("step_number", { ascending: true }),
  ]);

  const detailError = versionResult.error ?? itemResult.error ?? stepResult.error;
  if (detailError) {
    throw new Error("Failed to load approved recipe: " + detailError.message);
  }
  if (!versionResult.data) return null;

  const itemRows = itemResult.data ?? [];
  const referencedIngredientIds = Array.from(
    new Set(
      itemRows
        .map((row) => row.ingredient_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const dependencyVersionIds = Array.from(
    new Set(
      itemRows
        .map((row) => row.dependency_recipe_version_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [ingredientResult, dependencyVersionResult] = await Promise.all([
    includeOptions
      ? supabaseAdmin
          .from("ingredients")
          .select("id, name, measurement_kind")
          .is("retired_at", null)
          .order("name", { ascending: true })
      : referencedIngredientIds.length
        ? supabaseAdmin
            .from("ingredients")
            .select("id, name, measurement_kind")
            .in("id", referencedIngredientIds)
        : Promise.resolve({ data: [], error: null }),
    dependencyVersionIds.length
      ? supabaseAdmin
          .from("recipe_versions")
          .select("id, recipe_id")
          .in("id", dependencyVersionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lookupError = ingredientResult.error ?? dependencyVersionResult.error;
  if (lookupError) {
    throw new Error("Failed to load approved recipe lookups: " + lookupError.message);
  }

  const recipeIdByVersionId = new Map(
    (dependencyVersionResult.data ?? []).map((row) => [
      String(row.id),
      String(row.recipe_id),
    ]),
  );
  const referencedRecipeIds = Array.from(new Set(recipeIdByVersionId.values()));

  const recipeOptionsResult = includeOptions
    ? await supabaseAdmin
        .from("recipes")
        .select("id, name, current_approved_version_id")
        .is("retired_at", null)
        .not("current_approved_version_id", "is", null)
        .order("name", { ascending: true })
    : referencedRecipeIds.length
      ? await supabaseAdmin
          .from("recipes")
          .select("id, name, current_approved_version_id")
          .in("id", referencedRecipeIds)
      : { data: [], error: null };

  if (recipeOptionsResult.error) {
    throw new Error(
      "Failed to load approved recipe components: " + recipeOptionsResult.error.message,
    );
  }

  const ingredientNameById = new Map(
    (ingredientResult.data ?? []).map((row) => [String(row.id), String(row.name)]),
  );
  const recipeNameById = new Map(
    (recipeOptionsResult.data ?? []).map((row) => [String(row.id), String(row.name)]),
  );

  return {
    recipeId: String(recipe.id),
    versionId,
    name: String(recipe.name),
    recipeType: String(recipe.recipe_type),
    yieldKind: String(versionResult.data.yield_kind ?? ""),
    baseYield: Number(versionResult.data.base_yield ?? 0),
    yieldUnit: String(versionResult.data.yield_unit ?? ""),
    minimumBatchQuantity: Number(versionResult.data.minimum_batch_quantity ?? 0),
    minimumBatchUnit: String(versionResult.data.minimum_batch_unit ?? versionResult.data.yield_unit ?? ""),
    portionQuantity:
      versionResult.data.portion_quantity === null
        ? null
        : Number(versionResult.data.portion_quantity),
    portionUnit: versionResult.data.portion_unit ? String(versionResult.data.portion_unit) : null,
    chefNotes: String(versionResult.data.chef_notes ?? ""),
    items: (itemResult.data ?? []).map((row) => {
      const kind = row.item_kind === "recipe" ? "recipe" : "ingredient";
      const sourceId =
        kind === "ingredient"
          ? String(row.ingredient_id ?? "")
          : String(recipeIdByVersionId.get(String(row.dependency_recipe_version_id ?? "")) ?? "");
      return {
        id: String(row.id),
        kind,
        sourceId,
        name:
          kind === "ingredient"
            ? ingredientNameById.get(sourceId) ?? "Unknown ingredient"
            : recipeNameById.get(sourceId) ?? "Unknown component",
        quantity: Number(row.quantity ?? 0),
        unit: String(row.unit ?? ""),
        preparationNote: String(row.preparation_note ?? ""),
      };
    }),
    steps: (stepResult.data ?? []).map((row) => ({
      id: String(row.id),
      instruction: String(row.instruction ?? ""),
    })),
    ingredientOptions: includeOptions
      ? (ingredientResult.data ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.name),
          measurementKind:
            row.measurement_kind === "liquid"
              ? "liquid"
              : row.measurement_kind === "countable"
                ? "countable"
                : "solid",
        }))
      : [],
    componentOptions: includeOptions
      ? (recipeOptionsResult.data ?? [])
          .filter((row) => String(row.id) !== recipeId && row.current_approved_version_id)
          .map((row) => ({
            id: String(row.id),
            name: String(row.name),
            currentApprovedVersionId: String(row.current_approved_version_id),
          }))
      : [],
  };
}
