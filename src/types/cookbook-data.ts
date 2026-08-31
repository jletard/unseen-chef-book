export type MenuItemRecord = {
  id: string;
  name: string;
  shortName: string | null;
  description: string;
  menuType: string;
  category: string | null;
  proteinType: string;
  sides: string[];
  isVegan: boolean;
  active: boolean;
};

export type ReferenceRecord = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

export type IngredientRecord = {
  id: string;
  name: string;
  measurementKind: "liquid" | "solid" | "countable";
  active: boolean;
  notes: string | null;
};

export type RecipeRecord = {
  id: string;
  name: string;
  recipeType: string;
  status: "draft" | "complete" | "inactive";
  yieldKind: string | null;
  baseYield: number | null;
  yieldUnit: string | null;
  minimumBatch: number | null;
  notes: string | null;
};

export type MenuItemRecipeLink = {
  id: string;
  menuItemId: string;
  recipeId: string;
  role: "main" | "component" | "garnish";
  sortOrder: number;
};

export type SideRequirement = {
  name: string;
  quantity: number;
};

export type ProductionItem = {
  key: string;
  menuItemId: string | null;
  name: string;
  menuType: string;
  category: string;
  quantity: number;
  sideRequirements: SideRequirement[];
};

export type BulkProductionItem = {
  key: string;
  itemId: string;
  name: string;
  category: "Proteins" | "Sides";
  unitLabel: string;
  quantity: number;
};

export type ProductionSummary = {
  productionWeek: string;
  confirmedOrderCount: number;
  totalPortions: number;
  items: ProductionItem[];
  bulkItems: BulkProductionItem[];
};

export type RecipeItemRecord = {
  id: string;
  recipeId: string;
  itemType: "ingredient" | "component";
  ingredientId: string | null;
  componentRecipeId: string | null;
  quantity: number;
  unit: string;
  preparationNote: string | null;
  sortOrder: number;
  displayName: string;
};

export type RecipeStepRecord = {
  id: string;
  recipeId: string;
  stepNumber: number;
  instruction: string;
};
