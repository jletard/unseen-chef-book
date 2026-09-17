import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCookbookName } from "@/lib/cookbook-v2/normalize-name";
import { allergenLabels, type AllergenKey, type LabelIngredient, type RecipeLabel } from "@/lib/labeling-types";

export type { LabelIngredient, RecipeLabel } from "@/lib/labeling-types";

type VersionItem = {
  recipe_version_id: string;
  item_kind: "ingredient" | "recipe";
  ingredient_id: string | null;
  dependency_recipe_version_id: string | null;
  sort_order: number;
};

type IngredientComponentRow = {
  id: string;
  parent_ingredient_id: string;
  child_ingredient_id: string;
  sort_order: number;
  source_text: string | null;
};

type ResolvedLabelPart = {
  statement: string;
  allergens: Set<string>;
  incomplete: Set<string>;
};

const allergenSourceTerms: Partial<Record<AllergenKey, string[]>> = {
  fish: ["salmon", "tilapia", "cod", "trout", "tuna", "halibut", "haddock", "pollock", "anchovy", "sardine"],
  crustacean_shellfish: ["shrimp", "crab", "lobster", "crayfish"],
  tree_nuts: ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut"],
};

function inferAllergenSource(ingredientName: string, key: AllergenKey) {
  const normalized = normalizeCookbookName(ingredientName);
  const match = allergenSourceTerms[key]?.find((term) => normalized.includes(term));
  return match ? match.replace(/\b\w/gu, (letter) => letter.toUpperCase()) : "";
}

function isPlaceholderStatement(ingredient: LabelIngredient) {
  const statement = normalizeCookbookName(ingredient.ingredientStatement);
  return !statement
    || statement === normalizeCookbookName(ingredient.name)
    || statement === normalizeCookbookName(ingredient.labelName);
}

function compoundStatement(ingredient: LabelIngredient, contents: string) {
  const labelName = ingredient.labelName || ingredient.name;
  const trimmedContents = contents.trim();
  if (!trimmedContents) return labelName;
  const normalizedContents = normalizeCookbookName(trimmedContents);
  const normalizedLabelName = normalizeCookbookName(labelName);
  if (normalizedContents.startsWith(`${normalizedLabelName} (`)) return trimmedContents;
  return `${labelName} (${trimmedContents})`;
}

export async function getLabelingWorkspace(): Promise<{
  ingredients: LabelIngredient[];
  recipes: RecipeLabel[];
}> {
  const [ingredientResult, ingredientComponentResult, recipeResult, versionResult, itemResult, menuResult, sourceResult, linkResult, legacyLinkResult] = await Promise.all([
    supabaseAdmin.from("ingredients").select("id, name, ingredient_kind, label_name, ingredient_statement, allergen_keys, allergen_details, dietary_flags, label_review_status").is("retired_at", null).order("name"),
    supabaseAdmin.from("ingredient_components").select("id, parent_ingredient_id, child_ingredient_id, sort_order, source_text").order("parent_ingredient_id").order("sort_order").order("id"),
    supabaseAdmin.from("recipes").select("id, name, recipe_type, current_approved_version_id").is("retired_at", null).not("current_approved_version_id", "is", null).order("name"),
    supabaseAdmin.from("recipe_versions").select("id, recipe_id").eq("state", "approved"),
    supabaseAdmin.from("recipe_version_items").select("recipe_version_id, item_kind, ingredient_id, dependency_recipe_version_id, sort_order").order("sort_order"),
    supabaseAdmin.from("menu_items_v2").select("id, name, short_name, sides").order("name"),
    supabaseAdmin.from("production_item_sources").select("production_item_id, source_type, source_id, normalized_source_name").eq("mapping_state", "confirmed"),
    supabaseAdmin.from("production_item_recipe_links").select("production_item_id, recipe_id").eq("role", "main").eq("active", true),
    supabaseAdmin.from("menu_item_recipe_links").select("menu_item_id, recipe_id, role"),
  ]);

  const error = ingredientResult.error
    ?? ingredientComponentResult.error
    ?? recipeResult.error
    ?? versionResult.error
    ?? itemResult.error
    ?? menuResult.error
    ?? sourceResult.error
    ?? linkResult.error
    ?? legacyLinkResult.error;
  if (error) throw new Error(`Unable to load labeling workspace: ${error.message}`);

  const ingredients: LabelIngredient[] = (ingredientResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    ingredientKind: row.ingredient_kind === "compound" ? "compound" : "simple",
    labelName: String(row.label_name || row.name),
    ingredientStatement: String(row.ingredient_statement || row.label_name || row.name),
    allergenKeys: (row.allergen_keys ?? []) as AllergenKey[],
    allergenDetails: (row.allergen_details ?? {}) as Partial<Record<AllergenKey, string>>,
    dietaryFlags: (row.dietary_flags ?? []) as Array<"vegetarian">,
    reviewStatus: row.label_review_status === "confirmed" ? "confirmed" : "unreviewed",
  }));

  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const ingredientComponentsByParent = new Map<string, IngredientComponentRow[]>();
  for (const row of (ingredientComponentResult.data ?? []) as IngredientComponentRow[]) {
    const children = ingredientComponentsByParent.get(String(row.parent_ingredient_id)) ?? [];
    children.push(row);
    ingredientComponentsByParent.set(String(row.parent_ingredient_id), children);
  }

  function resolveIngredient(ingredientId: string, visited = new Set<string>()): ResolvedLabelPart {
    if (visited.has(ingredientId)) {
      const ingredient = ingredientById.get(ingredientId);
      return {
        statement: ingredient?.labelName || ingredient?.name || "Ingredient",
        allergens: new Set(),
        incomplete: new Set([`${ingredient?.name || "Ingredient"}: compound ingredient cycle`]),
      };
    }

    const ingredient = ingredientById.get(ingredientId);
    if (!ingredient) {
      return {
        statement: "Unknown ingredient",
        allergens: new Set(),
        incomplete: new Set(["Unknown ingredient"]),
      };
    }

    const allergens = new Set<string>();
    const incomplete = new Set<string>();

    if (ingredient.reviewStatus !== "confirmed") incomplete.add(ingredient.name);
    for (const key of ingredient.allergenKeys) {
      const detail = ingredient.allergenDetails[key]?.trim() || inferAllergenSource(ingredient.name, key);
      allergens.add(detail ? `${allergenLabels[key]} (${detail})` : allergenLabels[key]);
      if (["fish", "crustacean_shellfish", "tree_nuts"].includes(key) && !detail) {
        incomplete.add(`${ingredient.name}: specify allergen source`);
      }
    }

    if (ingredient.ingredientKind !== "compound") {
      return {
        statement: ingredient.ingredientStatement || ingredient.labelName || ingredient.name,
        allergens,
        incomplete,
      };
    }

    const children = ingredientComponentsByParent.get(ingredient.id) ?? [];
    if (children.length === 0) {
      incomplete.add(`${ingredient.name}: compound ingredients not structured`);
      return {
        statement: compoundStatement(ingredient, ingredient.ingredientStatement),
        allergens,
        incomplete,
      };
    }

    const nextVisited = new Set(visited).add(ingredient.id);
    const childStatements: string[] = [];
    for (const relationship of children) {
      const child = resolveIngredient(String(relationship.child_ingredient_id), nextVisited);
      const childIngredient = ingredientById.get(String(relationship.child_ingredient_id));
      const sourceText = relationship.source_text?.trim();
      childStatements.push(sourceText && childIngredient?.ingredientKind !== "compound" ? sourceText : child.statement);
      child.allergens.forEach((value) => allergens.add(value));
      child.incomplete.forEach((value) => incomplete.add(value));
    }

    const contents = isPlaceholderStatement(ingredient)
      ? childStatements.join(", ")
      : ingredient.ingredientStatement;
    const statement = compoundStatement(ingredient, contents);

    return { statement, allergens, incomplete };
  }

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
        const resolvedIngredient = resolveIngredient(item.ingredient_id);
        statements.push(resolvedIngredient.statement);
        resolvedIngredient.allergens.forEach((value) => allergens.add(value));
        resolvedIngredient.incomplete.forEach((value) => incomplete.add(value));
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
      recipeCategory: String(row.recipe_type || "other"),
      ingredientStatement: resolved.statements.join(", "),
      allergens: Array.from(resolved.allergens).sort(),
      incompleteIngredients: Array.from(resolved.incomplete).sort(),
    };
  });

  const recipeLabelById = new Map(recipes.map((item) => [item.recipeId, item]));
  const recipeLabelByName = new Map(recipes.map((item) => [normalizeCookbookName(item.name), item]));
  const productionItemByMenuId = new Map(
    (sourceResult.data ?? [])
      .filter((row) => row.source_type === "menu_item" && row.source_id)
      .map((row) => [String(row.source_id), String(row.production_item_id)]),
  );
  const productionItemBySourceName = new Map(
    (sourceResult.data ?? []).map((row) => [String(row.normalized_source_name), String(row.production_item_id)]),
  );
  const recipeIdByProductionItem = new Map(
    (linkResult.data ?? []).map((row) => [String(row.production_item_id), String(row.recipe_id)]),
  );
  const legacyRecipeIdByMenuId = new Map(
    (legacyLinkResult.data ?? [])
      .filter((row) => row.role === "main")
      .map((row) => [String(row.menu_item_id), String(row.recipe_id)]),
  );
  const menuLabels: RecipeLabel[] = [];
  const menuLinkedRecipeIds = new Set<string>();

  for (const menu of menuResult.data ?? []) {
    const productionItemId = productionItemByMenuId.get(String(menu.id));
    const linkedRecipeId = (productionItemId ? recipeIdByProductionItem.get(productionItemId) : undefined)
      ?? legacyRecipeIdByMenuId.get(String(menu.id));
    const mainRecipe = (linkedRecipeId ? recipeLabelById.get(linkedRecipeId) : undefined)
      ?? recipeLabelByName.get(normalizeCookbookName(String(menu.name)))
      ?? (menu.short_name ? recipeLabelByName.get(normalizeCookbookName(String(menu.short_name))) : undefined);
    if (!mainRecipe) continue;

    menuLinkedRecipeIds.add(mainRecipe.recipeId);
    const defaultSides = ((menu.sides ?? []) as string[]).map(String).filter((name: string) => name.trim());
    const statements = [mainRecipe.ingredientStatement ? `${mainRecipe.name} (${mainRecipe.ingredientStatement})` : mainRecipe.name];
    const variableSides: string[] = [];
    const sideSelections: NonNullable<RecipeLabel["sideSelections"]> = [];

    for (const sideName of defaultSides) {
      const optionNames = sideName.split(/\s+or\s+/iu).map((name) => name.trim()).filter(Boolean);
      if (optionNames.length > 1) {
        const options = optionNames.map((optionName) => {
          const normalizedOptionName = normalizeCookbookName(optionName);
          const optionProductionItemId = productionItemBySourceName.get(normalizedOptionName);
          const optionRecipeId = optionProductionItemId ? recipeIdByProductionItem.get(optionProductionItemId) : undefined;
          return (optionRecipeId ? recipeLabelById.get(optionRecipeId) : undefined)
            ?? recipeLabelByName.get(normalizedOptionName);
        });
        if (options.some(Boolean)) {
          sideSelections.push({ label: sideName });
          continue;
        }
      }
      const normalizedSideName = normalizeCookbookName(sideName);
      const sideProductionItemId = productionItemBySourceName.get(normalizedSideName);
      const sideRecipeId = sideProductionItemId ? recipeIdByProductionItem.get(sideProductionItemId) : undefined;
      const side = (sideRecipeId ? recipeLabelById.get(sideRecipeId) : undefined)
        ?? recipeLabelByName.get(normalizedSideName);
      if (!side) {
        if (normalizedSideName === "seasonal vegetables") {
          sideSelections.push({ label: sideName });
          continue;
        }
        sideSelections.push({ label: sideName });
        continue;
      }
      sideSelections.push({ label: sideName, recipeId: side.recipeId });
    }

    menuLabels.push({
      recipeId: `menu:${menu.id}`,
      name: String(menu.name),
      recipeCategory: mainRecipe.recipeCategory,
      defaultSides,
      variableSides,
      sideSelections,
      ingredientStatement: statements.filter(Boolean).join("; "),
      allergens: mainRecipe.allergens,
      incompleteIngredients: mainRecipe.incompleteIngredients,
    });
  }

  return {
    ingredients,
    recipes: [
      ...menuLabels,
      ...recipes.filter((recipe) => !menuLinkedRecipeIds.has(recipe.recipeId)),
    ].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
