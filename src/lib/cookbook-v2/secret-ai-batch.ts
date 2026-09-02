import type { SecretAIFormField, SecretAIFormSchema } from "@/components/SecretAIImportBox/SecretAIImportBox";
import {
  recipeCategories,
  recipeUnits,
  yieldKinds,
  type RecipeDraftPayload,
} from "@/lib/cookbook-v2/domain";

export const SECRET_AI_PACKET_SIZE = 10;

const ingredientLine: SecretAIFormField = {
  type: "object",
  fields: {
    kind: { type: "enum", values: ["ingredient", "recipe"], required: true },
    proposedName: {
      type: "string",
      required: true,
      description: "Exact purchased ingredient name, or exact inline/existing prepared recipe name.",
    },
    quantity: { type: "number", required: true },
    unit: { type: "string", required: true },
    preparationNote: { type: "string" },
  },
};

const step: SecretAIFormField = {
  type: "object",
  fields: {
    instruction: { type: "string", required: true },
    durationMinutes: { type: "number" },
    temperatureValue: { type: "number" },
    temperatureUnit: { type: "enum", values: ["F", "C"] },
    isAdvancePrep: { type: "boolean" },
    prepDayOffset: { type: "number" },
    station: { type: "string" },
  },
};

const equipment: SecretAIFormField = {
  type: "object",
  fields: {
    name: { type: "string", required: true },
    quantity: { type: "number" },
    note: { type: "string" },
  },
};

const recipeFields: Record<string, SecretAIFormField> = {
  name: { type: "string", required: true },
  recipeCategory: { type: "enum", values: [...recipeCategories], required: true },
  yieldKind: { type: "enum", values: [...yieldKinds], required: true },
  baseYield: { type: "number", required: true },
  yieldUnit: { type: "enum", values: [...recipeUnits], required: true },
  minimumBatchQuantity: { type: "number", required: true },
  minimumBatchUnit: { type: "string", required: true },
  portionQuantity: { type: "number" },
  portionUnit: { type: "string" },
  chefNotes: { type: "string" },
  productionNotes: { type: "string" },
  equipment: { type: "array", items: equipment, required: true },
  items: { type: "array", items: ingredientLine, required: true },
  steps: { type: "array", items: step, required: true },
};

const inlineComponent: SecretAIFormField = {
  type: "object",
  description: "A sauce, marinade, side, or other reusable sub-recipe that does not already exist.",
  fields: recipeFields,
};

export type SecretAIRecipeRequest = {
  jobId: string;
  productionItemId: string;
  name: string;
  kind: string;
  sources: unknown[];
};

export type SecretAIRecipeResult = {
  jobId: string;
  productionItemId: string;
  draft: Omit<RecipeDraftPayload, "equipment" | "items" | "steps"> & {
    equipment: Array<Omit<RecipeDraftPayload["equipment"][number], "id">>;
    items: Array<Omit<RecipeDraftPayload["items"][number], "id">>;
    steps: Array<Omit<RecipeDraftPayload["steps"][number], "id">>;
  };
  inlineComponents?: SecretAIRecipeResult["draft"][];
};

export function createRecipePacketSchema(jobIds: string[]): SecretAIFormSchema {
  return {
    name: "Cookbook recipe intake packet",
    description:
      "Create one complete kitchen-production recipe for every requested production item. Keep genuinely different ingredients distinct (for example boneless skinless chicken breast versus bone-in skin-on chicken thigh). For bulk proteins, use pounds (lb) for the purchased protein, base yield, and minimum practical batch because proteins are purchased and inventoried by the pound. Use oz when a smaller purchased protein weight is clearer. Use metric weights for dry ingredients and seasonings. Cups, quarts, and fluid ounces are liquid-only. Reuse an existing prepared recipe when named in the supplied context. Put any missing reusable sauce, marinade, side, or other sub-recipe in inlineComponents and reference its exact name from the parent draft as an item with kind recipe. Do not omit a requested job and do not add jobs.",
    fields: {
      recipes: {
        type: "array",
        required: true,
        items: {
          type: "object",
          fields: {
            jobId: { type: "enum", values: jobIds, required: true },
            productionItemId: { type: "string", required: true },
            requestContext: {
              type: "string",
              description: "Read-only source context. Return it unchanged.",
            },
            draft: { type: "object", fields: recipeFields, required: true },
            inlineComponents: { type: "array", items: inlineComponent },
          },
        },
      },
    },
  };
}

export function packetCurrentValues(requests: SecretAIRecipeRequest[]) {
  return {
    recipes: requests.map((request) => ({
      jobId: request.jobId,
      productionItemId: request.productionItemId,
      draft: {
        name: request.name,
        recipeCategory: request.kind === "side" || request.kind === "bulk_side" ? "side" : "main",
        equipment: [],
        items: [],
        steps: [],
      },
      inlineComponents: [],
      requestContext: JSON.stringify({
        requestedName: request.name,
        requestedKind: request.kind,
        knownSources: request.sources,
      }),
    })),
  };
}
