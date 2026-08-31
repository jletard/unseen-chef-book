import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
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
    .select("id, name, measurement_kind, active, notes")
    .order("active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Failed to load ingredients: " + error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    measurementKind: row.measurement_kind as IngredientRecord["measurementKind"],
    active: Boolean(row.active),
    notes: row.notes ? String(row.notes) : null,
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
  const { data, error } = await supabaseAdmin
    .from("menu_item_recipe_links")
    .select("id, menu_item_id, recipe_id, role, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error("Failed to load menu recipe links: " + error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    menuItemId: String(row.menu_item_id),
    recipeId: String(row.recipe_id),
    role: row.role as MenuItemRecipeLink["role"],
    sortOrder: Number(row.sort_order ?? 0),
  }));
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
  const [{ data, error }, ingredients, recipes] = await Promise.all([
    supabaseAdmin
      .from("recipe_items")
      .select(
        "id, recipe_id, item_type, ingredient_id, component_recipe_id, quantity, unit, preparation_note, sort_order",
      )
      .eq("recipe_id", recipeId)
      .order("sort_order", { ascending: true }),
    getIngredients(),
    getRecipes(),
  ]);

  if (error) {
    throw new Error("Failed to load recipe items: " + error.message);
  }

  const ingredientNames = new Map(
    ingredients.map((ingredient) => [ingredient.id, ingredient.name]),
  );
  const recipeNames = new Map(
    recipes.map((recipe) => [recipe.id, recipe.name]),
  );

  return ((data ?? []) as RecipeItemRow[]).map((row) => ({
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
