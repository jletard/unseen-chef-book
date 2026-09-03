import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { allergenLabels, type AllergenKey, type LabelIngredient, type RecipeLabel } from "@/lib/labeling-types";

export type { LabelIngredient, RecipeLabel } from "@/lib/labeling-types";

type VersionItem = {
  recipe_version_id: string;
  item_kind: "ingredient" | "recipe";
  ingredient_id: string | null;
  dependency_recipe_version_id: string | null;
  sort_order: number;
};

export async function getLabelingWorkspace(): Promise<{
  ingredients: LabelIngredient[];
  recipes: RecipeLabel[];
}> {
  const [ingredientResult, recipeResult, versionResult, itemResult] = await Promise.all([
    supabaseAdmin.from("ingredients").select("id, name, label_name, ingredient_statement, allergen_keys, allergen_details, label_review_status").is("retired_at", null).order("name"),
    supabaseAdmin.from("recipes").select("id, name, current_approved_version_id").is("retired_at", null).not("current_approved_version_id", "is", null).order("name"),
    supabaseAdmin.from("recipe_versions").select("id, recipe_id").eq("state", "approved"),
    supabaseAdmin.from("recipe_version_items").select("recipe_version_id, item_kind, ingredient_id, dependency_recipe_version_id, sort_order").order("sort_order"),
  ]);

  const error = ingredientResult.error ?? recipeResult.error ?? versionResult.error ?? itemResult.error;
  if (error) throw new Error(`Unable to load labeling workspace: ${error.message}`);

  const ingredients: LabelIngredient[] = (ingredientResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    labelName: String(row.label_name || row.name),
    ingredientStatement: String(row.ingredient_statement || row.label_name || row.name),
    allergenKeys: (row.allergen_keys ?? []) as AllergenKey[],
    allergenDetails: (row.allergen_details ?? {}) as Partial<Record<AllergenKey, string>>,
    reviewStatus: row.label_review_status === "confirmed" ? "confirmed" : "unreviewed",
  }));

  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const recipeByVersion = new Map((versionResult.data ?? []).map((row) => [String(row.id), String(row.recipe_id)]));
  const recipeNameById = new Map((recipeResult.data ?? []).map((row) => [String(row.id), String(row.name)]));
  const itemsByVersion = new Map<string, VersionItem[]>();
  for (const row of (itemResult.data ?? []) as VersionItem[]) {
    const items = itemsByVersion.get(row.recipe_version_id) ?? [];
    items.push(row);
    itemsByVersion.set(row.recipe_version_id, items);
  }

  function resolveVersion(versionId: string, visited = new Set<string>()): {
    statements: string[];
    allergens: Set<string>;
    incomplete: Set<string>;
  } {
    if (visited.has(versionId)) return { statements: [], allergens: new Set(), incomplete: new Set(["Recipe dependency cycle"]) };
    const nextVisited = new Set(visited).add(versionId);
    const statements: string[] = [];
    const allergens = new Set<string>();
    const incomplete = new Set<string>();

    for (const item of itemsByVersion.get(versionId) ?? []) {
      if (item.item_kind === "ingredient" && item.ingredient_id) {
        const ingredient = ingredientById.get(item.ingredient_id);
        if (!ingredient) {
          incomplete.add("Unknown ingredient");
          continue;
        }
        statements.push(ingredient.ingredientStatement);
        if (ingredient.reviewStatus !== "confirmed") incomplete.add(ingredient.name);
        for (const key of ingredient.allergenKeys) {
          const detail = ingredient.allergenDetails[key]?.trim();
          allergens.add(detail ? `${allergenLabels[key]} (${detail})` : allergenLabels[key]);
          if (["fish", "crustacean_shellfish", "tree_nuts"].includes(key) && !detail) {
            incomplete.add(`${ingredient.name}: specify allergen source`);
          }
        }
      } else if (item.item_kind === "recipe" && item.dependency_recipe_version_id) {
        const child = resolveVersion(item.dependency_recipe_version_id, nextVisited);
        const childRecipeId = recipeByVersion.get(item.dependency_recipe_version_id);
        const childName = childRecipeId ? recipeNameById.get(childRecipeId) : undefined;
        statements.push(childName && child.statements.length ? `${childName} (${child.statements.join(", ")})` : childName || "Prepared component");
        child.allergens.forEach((value) => allergens.add(value));
        child.incomplete.forEach((value) => incomplete.add(value));
      }
    }
    return { statements, allergens, incomplete };
  }

  const recipes: RecipeLabel[] = (recipeResult.data ?? []).map((row) => {
    const resolved = resolveVersion(String(row.current_approved_version_id));
    return {
      recipeId: String(row.id),
      name: String(row.name),
      ingredientStatement: resolved.statements.join(", "),
      allergens: Array.from(resolved.allergens).sort(),
      incompleteIngredients: Array.from(resolved.incomplete).sort(),
    };
  });

  return { ingredients, recipes };
}
