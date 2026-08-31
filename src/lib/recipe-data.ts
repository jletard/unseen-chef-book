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
