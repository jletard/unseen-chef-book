export const recipeCategories = [
  "main",
  "side",
  "component",
  "sauce",
  "dressing",
  "dessert",
  "bread",
  "other",
] as const;

export const reviewBuckets = [
  "unreviewed",
  "needs_classification",
  "minor",
  "major",
  "ready",
] as const;

export const draftStates = [
  "editing",
  "ready_for_review",
  "blocked",
  "failed",
  "archived",
] as const;

export const yieldKinds = [
  "servings",
  "liquid",
  "solid",
  "countable",
] as const;

export const recipeUnits = [
  "serving",
  "each",
  "oz",
  "lb",
  "fl_oz",
  "cup",
  "quart",
  "g",
  "kg",
] as const;

export type RecipeCategory = (typeof recipeCategories)[number];
export type ReviewBucket = (typeof reviewBuckets)[number];
export type DraftState = (typeof draftStates)[number];
export type YieldKind = (typeof yieldKinds)[number];
export type RecipeUnit = (typeof recipeUnits)[number];

export type DraftIngredientLine = {
  id: string;
  kind: "ingredient";
  ingredientId?: string;
  proposedName?: string;
  quantity: number;
  unit: string;
  preparationNote?: string;
};

export type DraftRecipeLine = {
  id: string;
  kind: "recipe";
  recipeId?: string;
  recipeVersionId?: string;
  nestedDraftId?: string;
  proposedName?: string;
  quantity: number;
  unit: string;
  preparationNote?: string;
};

export type DraftStep = {
  id: string;
  instruction: string;
  durationMinutes?: number;
  temperatureValue?: number;
  temperatureUnit?: "F" | "C";
  isAdvancePrep?: boolean;
  prepDayOffset?: number;
  station?: string;
};

export type RecipeDraftPayload = {
  name: string;
  recipeCategory: RecipeCategory;
  yieldKind?: YieldKind;
  baseYield?: number;
  yieldUnit?: RecipeUnit;
  minimumBatchQuantity?: number;
  minimumBatchUnit?: string;
  portionQuantity?: number;
  portionUnit?: string;
  chefNotes?: string;
  productionNotes?: string;
  equipment: Array<{ id: string; name: string; quantity?: number; note?: string }>;
  items: Array<DraftIngredientLine | DraftRecipeLine>;
  steps: DraftStep[];
};

export type DraftValidationError = {
  path: string;
  code: string;
  message: string;
};

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validateRecipeDraftPayload(
  value: unknown,
): DraftValidationError[] {
  const errors: DraftValidationError[] = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [
      {
        path: "$",
        code: "invalid_payload",
        message: "Draft payload must be an object.",
      },
    ];
  }

  const draft = value as Record<string, unknown>;

  if (typeof draft.name !== "string" || draft.name.trim().length === 0) {
    errors.push({
      path: "name",
      code: "required",
      message: "Recipe name is required.",
    });
  }

  if (!isOneOf(draft.recipeCategory, recipeCategories)) {
    errors.push({
      path: "recipeCategory",
      code: "invalid_recipe_category",
      message: "Choose a recognized recipe category.",
    });
  }

  if (draft.yieldKind !== undefined && !isOneOf(draft.yieldKind, yieldKinds)) {
    errors.push({
      path: "yieldKind",
      code: "invalid_yield_kind",
      message: "Choose a recognized yield kind.",
    });
  }

  if (draft.baseYield !== undefined && !isPositiveNumber(draft.baseYield)) {
    errors.push({
      path: "baseYield",
      code: "invalid_quantity",
      message: "Base yield must be greater than zero.",
    });
  }

  if (draft.yieldUnit !== undefined && !isOneOf(draft.yieldUnit, recipeUnits)) {
    errors.push({
      path: "yieldUnit",
      code: "invalid_unit",
      message: "Choose a recognized yield unit.",
    });
  }

  if (
    draft.minimumBatchQuantity !== undefined &&
    !isPositiveNumber(draft.minimumBatchQuantity)
  ) {
    errors.push({
      path: "minimumBatchQuantity",
      code: "invalid_quantity",
      message: "Minimum batch must be greater than zero.",
    });
  }

  if (!Array.isArray(draft.items)) {
    errors.push({
      path: "items",
      code: "invalid_collection",
      message: "Recipe items must be a list.",
    });
  } else {
    draft.items.forEach((item, index) => {
      const path = `items.${index}`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        errors.push({ path, code: "invalid_item", message: "Invalid recipe item." });
        return;
      }

      const line = item as Record<string, unknown>;
      if (line.kind !== "ingredient" && line.kind !== "recipe") {
        errors.push({
          path: `${path}.kind`,
          code: "invalid_item_kind",
          message: "An item must be a purchased ingredient or prepared recipe.",
        });
      }
      if (!isPositiveNumber(line.quantity)) {
        errors.push({
          path: `${path}.quantity`,
          code: "invalid_quantity",
          message: "Item quantity must be greater than zero.",
        });
      }
      if (typeof line.unit !== "string" || line.unit.trim().length === 0) {
        errors.push({
          path: `${path}.unit`,
          code: "required",
          message: "Item unit is required.",
        });
      }
    });
  }

  if (!Array.isArray(draft.steps)) {
    errors.push({
      path: "steps",
      code: "invalid_collection",
      message: "Recipe steps must be a list.",
    });
  } else {
    draft.steps.forEach((step, index) => {
      if (
        !step ||
        typeof step !== "object" ||
        Array.isArray(step) ||
        typeof (step as Record<string, unknown>).instruction !== "string" ||
        ((step as Record<string, unknown>).instruction as string).trim().length === 0
      ) {
        errors.push({
          path: `steps.${index}.instruction`,
          code: "required",
          message: "Step instruction is required.",
        });
      }
    });
  }

  if (!Array.isArray(draft.equipment)) {
    errors.push({
      path: "equipment",
      code: "invalid_collection",
      message: "Equipment must be a list.",
    });
  }

  return errors;
}

export function isRecipeDraftReadyForApproval(value: unknown) {
  const errors = validateRecipeDraftPayload(value);
  const draft = value as Partial<RecipeDraftPayload> | null;

  if (!draft?.yieldKind || !draft.baseYield || !draft.yieldUnit) {
    errors.push({
      path: "yield",
      code: "incomplete_yield",
      message: "Yield kind, quantity, and unit are required for approval.",
    });
  }
  if (!draft?.minimumBatchQuantity || !draft.minimumBatchUnit) {
    errors.push({
      path: "minimumBatch",
      code: "incomplete_minimum_batch",
      message: "Minimum practical batch is required for approval.",
    });
  }
  if (!draft?.items?.length) {
    errors.push({
      path: "items",
      code: "empty_recipe",
      message: "At least one ingredient or prepared recipe is required.",
    });
  }
  if (!draft?.steps?.length) {
    errors.push({
      path: "steps",
      code: "empty_method",
      message: "At least one preparation step is required.",
    });
  }

  return { ready: errors.length === 0, errors };
}
