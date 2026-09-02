import type { RecipeDraftPayload } from "@/lib/cookbook-v2/domain";

export type RecipeGenerationSource = {
  sourceType: string;
  sourceId: string | null;
  name: string;
  mappingState: "confirmed" | "proposed" | "rejected";
};

export type RecipeGenerationInput = {
  jobId: string;
  idempotencyKey: string;
  productionItem: {
    id: string;
    name: string;
    kind: string;
    active: boolean;
    recipeRequirement: "required" | "optional" | "none";
  };
  sources: RecipeGenerationSource[];
};

export type RecipeGenerationResult = {
  payload: RecipeDraftPayload;
  provider: string;
  model: string;
  providerRequestId?: string;
  warnings: string[];
  rawResponseReference?: string;
};

export interface RecipeGenerationProvider {
  readonly name: string;
  generateRecipe(input: RecipeGenerationInput): Promise<RecipeGenerationResult>;
}

export class RecipeGenerationNotConfiguredError extends Error {
  constructor() {
    super("No recipe generation provider is configured.");
    this.name = "RecipeGenerationNotConfiguredError";
  }
}
