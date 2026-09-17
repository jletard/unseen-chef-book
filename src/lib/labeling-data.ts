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
  quantity: number;
  unit: string;
  sort_order: number;
};

type RecipeVersionRow = {
  id: string;
  recipe_id: string;
  base_yield: number | null;
  yield_kind: string | null;
  yield_unit: string | null;
};

type IngredientComponentRow = {
  id: string;
  parent_ingredient_id: string;
  child_ingredient_id: string;
  sort_order: number;
  source_text: string | null;
};

type MassConversionRow = {
  ingredient_id: string;
  quantity: number;
  unit: string;
  grams: number;
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

const massUnitToGrams: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

const liquidUnitToMl: Record<string, number> = {
  ml: 1,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  fl_oz: 29.5735295625,
  cup: 236.5882365,
  quart: 946.352946,
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

function purchasedIngredientStatement(ingredient: LabelIngredient) {
  if (isPlaceholderStatement(ingredient)) {
    return ingredient.labelName || ingredient.name;
  }
  return compoundStatement(ingredient, ingredient.ingredientStatement);
}

function directMassToGrams(quantity: number, unit: string) {
  const factor = massUnitToGrams[unit];
  return factor ? quantity * factor : null;
}

function liquidToMl(quantity: number, unit: string) {
  const factor = liquidUnitToMl[unit];
  return factor ? quantity * factor : null;
}

export async function getLabelingWorkspace(): Promise<{
  ingredients: LabelIngredient[];
  recipes: RecipeLabel[];
}> {
  const [
    ingredientResult,
    ingredientComponentResult,
    massConversionResult,
    recipeResult,
    versionResult,
    itemResult,
    menuResult,
    sourceResult,
    linkResult,
    legacyLinkResult,
  ] = await Promise.all([
    supabaseAdmin.from("ingredients").select("id, name, ingredient_kind, label_name, ingredient_statement, allergen_keys, allergen_details, dietary_flags, label_review_status, nutrition_reference_ingredient_id").is("retired_at", null).order("name"),
    supabaseAdmin.from("ingredient_components").select("id, parent_ingredient_id, child_ingredient_id, sort_order, source_text").order("parent_ingredient_id").order("sort_order").order("id"),
    supabaseAdmin.from("ingredient_mass_conversions").select("ingredient_id, quantity, unit, grams"),
    supabaseAdmin.from("recipes").select("id, name, recipe_type, current_approved_version_id").is("retired_at", null).not("current_approved_version_id", "is", null).order("name"),
    supabaseAdmin.from("recipe_versions").select("id, recipe_id, base_yield, yield_kind, yield_unit").eq("state", "approved"),
    supabaseAdmin.from("recipe_version_items").select("recipe_version_id, item_kind, ingredient_id, dependency_recipe_version_id, quantity, unit, sort_order").order("sort_order"),
    supabaseAdmin.from("menu_items_v2").select("id, name, short_name, sides").order("name"),
    supabaseAdmin.from("production_item_sources").select("production_item_id, source_type, source_id, normalized_source_name").eq("mapping_state", "confirmed"),
    supabaseAdmin.from("production_item_recipe_links").select("production_item_id, recipe_id").eq("role", "main").eq("active", true),
    supabaseAdmin.from("menu_item_recipe_links").select("menu_item_id, recipe_id, role"),
  ]);

  const error = ingredientResult.error
    ?? ingredientComponentResult.error
    ?? massConversionResult.error
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
  const nutritionReferenceByIngredient = new Map(
    (ingredientResult.data ?? []).map((row) => [
      String(row.id),
      row.nutrition_reference_ingredient_id ? String(row.nutrition_reference_ingredient_id) : null,
    ]),
  );
  const massConversionByIngredientAndUnit = new Map<string, MassConversionRow>();
  for (const row of (massConversionResult.data ?? []) as MassConversionRow[]) {
    massConversionByIngredientAndUnit.set(`${row.ingredient_id}:${row.unit}`, {
      ingredient_id: String(row.ingredient_id),
      quantity: Number(row.quantity),
      unit: String(row.unit),
      grams: Number(row.grams),
    });
  }

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
      return { statement: "Unknown ingredient", allergens: new Set(), incomplete: new Set(["Unknown ingredient"]) };
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
        statement: purchasedIngredientStatement(ingredient),
        allergens,
        incomplete,
      };
    }

    const children = ingredientComponentsByParent.get(ingredient.id) ?? [];
    if (children.length === 0) {
      incomplete.add(`${ingredient.name}: compound ingredients not structured`);
      return {
        statement: purchasedIngredientStatement(ingredient),
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
    return { statement: compoundStatement(ingredient, contents), allergens, incomplete };
  }

  const recipeVersions: RecipeVersionRow[] = (versionResult.data ?? []).map((row) => ({
    id: String(row.id),
    recipe_id: String(row.recipe_id),
    base_yield: row.base_yield === null ? null : Number(row.base_yield),
    yield_kind: row.yield_kind ? String(row.yield_kind) : null,
    yield_unit: row.yield_unit ? String(row.yield_unit) : null,
  }));
  const versionById = new Map(recipeVersions.map((row) => [String(row.id), row]));
  const recipeByVersion = new Map(recipeVersions.map((row) => [String(row.id), String(row.recipe_id)]));
  const recipeNameById = new Map((recipeResult.data ?? []).map((row) => [String(row.id), String(row.name)]));
  const itemsByVersion = new Map<string, VersionItem[]>();
  for (const raw of (itemResult.data ?? []) as VersionItem[]) {
    const row: VersionItem = {
      recipe_version_id: String(raw.recipe_version_id),
      item_kind: raw.item_kind,
      ingredient_id: raw.ingredient_id ? String(raw.ingredient_id) : null,
      dependency_recipe_version_id: raw.dependency_recipe_version_id ? String(raw.dependency_recipe_version_id) : null,
      quantity: Number(raw.quantity),
      unit: String(raw.unit),
      sort_order: Number(raw.sort_order),
    };
    const items = itemsByVersion.get(row.recipe_version_id) ?? [];
    items.push(row);
    itemsByVersion.set(row.recipe_version_id, items);
  }

  function gramsForIngredient(ingredientId: string, quantity: number, unit: string) {
    const direct = directMassToGrams(quantity, unit);
    if (direct !== null) return direct;

    const visited = new Set<string>();
    let currentId: string | null = ingredientId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const conversion = massConversionByIngredientAndUnit.get(`${currentId}:${unit}`);
      if (conversion && conversion.quantity > 0) {
        return quantity * conversion.grams / conversion.quantity;
      }
      currentId = nutritionReferenceByIngredient.get(currentId) ?? null;
    }
    return null;
  }

  function scaleForRequestedComponent(item: VersionItem) {
    if (!item.dependency_recipe_version_id) return null;
    const childVersion = versionById.get(item.dependency_recipe_version_id);
    if (!childVersion || childVersion.base_yield === null || !childVersion.yield_unit || childVersion.base_yield <= 0) return null;

    const baseYield = Number(childVersion.base_yield);
    if (childVersion.yield_kind === "solid") {
      const requested = directMassToGrams(item.quantity, item.unit);
      const base = directMassToGrams(baseYield, childVersion.yield_unit);
      return requested !== null && base ? requested / base : null;
    }
    if (childVersion.yield_kind === "liquid") {
      const requested = liquidToMl(item.quantity, item.unit);
      const base = liquidToMl(baseYield, childVersion.yield_unit);
      return requested !== null && base ? requested / base : null;
    }
    if (childVersion.yield_kind === "countable" && item.unit === "each" && childVersion.yield_unit === "each") {
      return item.quantity / baseYield;
    }
    if (childVersion.yield_kind === "servings" && item.unit === "serving" && childVersion.yield_unit === "serving") {
      return item.quantity / baseYield;
    }
    if (item.unit === childVersion.yield_unit) return item.quantity / baseYield;
    return null;
  }

  const batchWeightCache = new Map<string, number | null>();
  function formulationWeightForVersion(versionId: string, visited = new Set<string>()): number | null {
    if (batchWeightCache.has(versionId)) return batchWeightCache.get(versionId) ?? null;
    if (visited.has(versionId)) return null;
    const nextVisited = new Set(visited).add(versionId);
    const items = itemsByVersion.get(versionId) ?? [];
    if (items.length === 0) return null;

    let total = 0;
    for (const item of items) {
      let grams: number | null = null;
      if (item.item_kind === "ingredient" && item.ingredient_id) {
        grams = gramsForIngredient(item.ingredient_id, item.quantity, item.unit);
      } else if (item.item_kind === "recipe" && item.dependency_recipe_version_id) {
        const childBatchWeight = formulationWeightForVersion(item.dependency_recipe_version_id, nextVisited);
        const scale = scaleForRequestedComponent(item);
        grams = childBatchWeight !== null && scale !== null ? childBatchWeight * scale : null;
      }
      if (grams === null || !Number.isFinite(grams)) {
        batchWeightCache.set(versionId, null);
        return null;
      }
      total += grams;
    }
    batchWeightCache.set(versionId, total);
    return total;
  }

  function itemFormulationWeight(item: VersionItem) {
    if (item.item_kind === "ingredient" && item.ingredient_id) {
      return gramsForIngredient(item.ingredient_id, item.quantity, item.unit);
    }
    if (item.item_kind === "recipe" && item.dependency_recipe_version_id) {
      const childWeight = formulationWeightForVersion(item.dependency_recipe_version_id);
      const scale = scaleForRequestedComponent(item);
      return childWeight !== null && scale !== null ? childWeight * scale : null;
    }
    return null;
  }

  function orderedVersionItems(versionId: string) {
    const items = [...(itemsByVersion.get(versionId) ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const weighted = items.map((item) => ({ item, grams: itemFormulationWeight(item) }));
    if (weighted.some(({ grams }) => grams === null || !Number.isFinite(grams))) return items;
    return weighted
      .sort((a, b) => (b.grams as number) - (a.grams as number) || a.item.sort_order - b.item.sort_order)
      .map(({ item }) => item);
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

    for (const item of orderedVersionItems(versionId)) {
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