export const allergenLabels = {
  milk: "Milk",
  egg: "Egg",
  fish: "Fish",
  crustacean_shellfish: "Crustacean Shellfish",
  tree_nuts: "Tree Nuts",
  peanuts: "Peanuts",
  wheat: "Wheat",
  soy: "Soy",
  sesame: "Sesame",
} as const;

export type AllergenKey = keyof typeof allergenLabels;

export type LabelIngredient = {
  id: string;
  name: string;
  labelName: string;
  ingredientStatement: string;
  allergenKeys: AllergenKey[];
  allergenDetails: Partial<Record<AllergenKey, string>>;
  dietaryFlags: Array<"vegetarian">;
  reviewStatus: "unreviewed" | "confirmed";
};

export type RecipeLabel = {
  recipeId: string;
  name: string;
  defaultSides?: string[];
  ingredientStatement: string;
  allergens: string[];
  incompleteIngredients: string[];
};
