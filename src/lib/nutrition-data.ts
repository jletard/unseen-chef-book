import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecipeNutritionRecord = {
  recipeId: string;
  recipeName: string;
  baseYield: number;
  yieldUnit: string;
  nutritionComplete: boolean;
  nutritionIssueCount: number;
  caloriesPerServing: number | null;
  proteinPerServing: number | null;
  carbsPerServing: number | null;
  fatPerServing: number | null;
  fiberPerServing: number | null;
  sodiumPerServing: number | null;
};

export type IngredientNutritionRecord = {
  ingredientId: string;
  ingredientName: string;
  sourceIngredientName: string;
  inheritsNutrition: boolean;
  basisQuantity: number | null;
  basisUnit: string | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  totalFatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  sourceType: string | null;
  sourceName: string | null;
  confidence: string | null;
  manualOverride: boolean;
};

export async function getRecipeNutrition(): Promise<RecipeNutritionRecord[]> {
  const [{ data, error }, { data: recipes, error: recipesError }] = await Promise.all([
    supabaseAdmin
      .from("recipe_version_nutrition_calculated")
      .select(
        "recipe_id, recipe_name, base_yield, yield_unit, nutrition_complete, nutrition_issue_count, calories_per_yield_unit, protein_g_per_yield_unit, carbohydrate_g_per_yield_unit, total_fat_g_per_yield_unit, fiber_g_per_yield_unit, sodium_mg_per_yield_unit",
      )
      .eq("is_current_approved", true)
      .order("recipe_name", { ascending: true }),
    supabaseAdmin
      .from("recipes")
      .select("id, nutrition_applicable"),
  ]);

  if (error) throw new Error("Failed to load recipe nutrition: " + error.message);
  if (recipesError) throw new Error("Failed to load nutrition applicability: " + recipesError.message);

  const applicable = new Map(
    (recipes ?? []).map((row) => [String(row.id), row.nutrition_applicable !== false]),
  );

  return (data ?? [])
    .filter((row) => applicable.get(String(row.recipe_id)) !== false)
    .map((row) => ({
      recipeId: String(row.recipe_id),
      recipeName: String(row.recipe_name),
      baseYield: Number(row.base_yield ?? 0),
      yieldUnit: String(row.yield_unit ?? "serving"),
      nutritionComplete: Boolean(row.nutrition_complete),
      nutritionIssueCount: Number(row.nutrition_issue_count ?? 0),
      caloriesPerServing: row.calories_per_yield_unit === null ? null : Number(row.calories_per_yield_unit),
      proteinPerServing: row.protein_g_per_yield_unit === null ? null : Number(row.protein_g_per_yield_unit),
      carbsPerServing: row.carbohydrate_g_per_yield_unit === null ? null : Number(row.carbohydrate_g_per_yield_unit),
      fatPerServing: row.total_fat_g_per_yield_unit === null ? null : Number(row.total_fat_g_per_yield_unit),
      fiberPerServing: row.fiber_g_per_yield_unit === null ? null : Number(row.fiber_g_per_yield_unit),
      sodiumPerServing: row.sodium_mg_per_yield_unit === null ? null : Number(row.sodium_mg_per_yield_unit),
    }));
}

export async function getIngredientNutrition(): Promise<IngredientNutritionRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("ingredient_primary_nutrition")
    .select(
      "ingredient_id, ingredient_name, nutrition_source_ingredient_name, inherits_nutrition, basis_quantity, basis_unit, calories_kcal, protein_g, carbohydrate_g, total_fat_g, fiber_g, sodium_mg, source_type, source_name, confidence, is_manual_override",
    )
    .order("ingredient_name", { ascending: true });

  if (error) throw new Error("Failed to load ingredient nutrition: " + error.message);

  return (data ?? []).map((row) => ({
    ingredientId: String(row.ingredient_id),
    ingredientName: String(row.ingredient_name),
    sourceIngredientName: String(row.nutrition_source_ingredient_name ?? row.ingredient_name),
    inheritsNutrition: Boolean(row.inherits_nutrition),
    basisQuantity: row.basis_quantity === null ? null : Number(row.basis_quantity),
    basisUnit: row.basis_unit ? String(row.basis_unit) : null,
    caloriesKcal: row.calories_kcal === null ? null : Number(row.calories_kcal),
    proteinG: row.protein_g === null ? null : Number(row.protein_g),
    carbohydrateG: row.carbohydrate_g === null ? null : Number(row.carbohydrate_g),
    totalFatG: row.total_fat_g === null ? null : Number(row.total_fat_g),
    fiberG: row.fiber_g === null ? null : Number(row.fiber_g),
    sodiumMg: row.sodium_mg === null ? null : Number(row.sodium_mg),
    sourceType: row.source_type ? String(row.source_type) : null,
    sourceName: row.source_name ? String(row.source_name) : null,
    confidence: row.confidence ? String(row.confidence) : null,
    manualOverride: Boolean(row.is_manual_override),
  }));
}
