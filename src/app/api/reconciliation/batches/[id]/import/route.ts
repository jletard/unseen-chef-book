import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { validateRecipeDraftPayload, type RecipeDraftPayload } from "@/lib/cookbook-v2/domain";
import type { SecretAIRecipeResult } from "@/lib/cookbook-v2/secret-ai-batch";
import { createClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function addOwnedIds(draft: SecretAIRecipeResult["draft"]): RecipeDraftPayload {
  return {
    ...draft,
    equipment: draft.equipment.map((item) => ({ ...item, id: randomUUID() })),
    items: draft.items.map((item) => ({ ...item, id: randomUUID() })) as RecipeDraftPayload["items"],
    steps: draft.steps.map((item) => ({ ...item, id: randomUUID() })),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: batchId } = await context.params;
  if (!uuidPattern.test(batchId)) {
    return NextResponse.json({ error: "Invalid batch ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { recipes?: SecretAIRecipeResult[] };
  try {
    body = (await request.json()) as { recipes?: SecretAIRecipeResult[] };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const recipes = body.recipes;
  if (!Array.isArray(recipes) || recipes.length < 1 || recipes.length > 10) {
    return NextResponse.json({ error: "A packet must contain between 1 and 10 recipes." }, { status: 400 });
  }
  if (new Set(recipes.map((recipe) => recipe.jobId)).size !== recipes.length) {
    return NextResponse.json({ error: "A packet contains a duplicate recipe job." }, { status: 400 });
  }

  try {
    const packet = recipes.map((recipe) => {
      if (!uuidPattern.test(recipe.jobId) || !uuidPattern.test(recipe.productionItemId)) {
        throw new Error("A recipe contains an invalid job or production item ID.");
      }

      const components = (recipe.inlineComponents ?? []).map((rawDraft) => {
        const draft = addOwnedIds(rawDraft);
        const errors = validateRecipeDraftPayload(draft);
        if (errors.length) throw new Error(`${draft.name}: ${errors[0].message}`);
        return { id: randomUUID(), draft };
      });
      const componentByName = new Map(
        components.map((component) => [component.draft.name.trim().toLocaleLowerCase(), component]),
      );
      if (componentByName.size !== components.length) {
        throw new Error(`${recipe.draft.name}: inline component names must be unique.`);
      }

      const draft = addOwnedIds(recipe.draft);
      draft.items = draft.items.map((line) => {
        if (line.kind !== "recipe" || !line.proposedName) return line;
        const component = componentByName.get(line.proposedName.trim().toLocaleLowerCase());
        return component ? { ...line, nestedDraftId: component.id } : line;
      });
      for (const component of components) {
        if (!draft.items.some((line) => line.kind === "recipe" && line.nestedDraftId === component.id)) {
          throw new Error(
            `${draft.name}: inline component “${component.draft.name}” is not used by the parent recipe.`,
          );
        }
      }
      const errors = validateRecipeDraftPayload(draft);
      if (errors.length) throw new Error(`${draft.name}: ${errors[0].message}`);

      return {
        jobId: recipe.jobId,
        productionItemId: recipe.productionItemId,
        draft,
        components,
      };
    });

    const { data, error } = await supabase.rpc("import_secret_ai_recipe_packet", {
      intake_batch_id: batchId,
      packet_payload: packet,
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      importedJobs: result?.imported_jobs ?? recipes.length,
      importedComponents: result?.imported_components ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Packet could not be imported." },
      { status: 400 },
    );
  }
}
