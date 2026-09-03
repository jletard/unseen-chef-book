import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { validateRecipeDraftPayload, type RecipeDraftPayload } from "@/lib/cookbook-v2/domain";
import type { SecretAIMajorRevision, SecretAIRecipeResult } from "@/lib/cookbook-v2/secret-ai-batch";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function addOwnedIds(draft: SecretAIRecipeResult["draft"]): RecipeDraftPayload {
  const keepOrCreate = (id: unknown) => typeof id === "string" && uuidPattern.test(id) ? id : randomUUID();
  const suppliedId = (item: object) => (item as { id?: unknown }).id;
  return {
    ...draft,
    equipment: draft.equipment.map((item) => ({ ...item, id: keepOrCreate(suppliedId(item)) })),
    items: draft.items.map((item) => ({ ...item, id: keepOrCreate(suppliedId(item)) })) as RecipeDraftPayload["items"],
    steps: draft.steps.map((item) => ({ ...item, id: keepOrCreate(suppliedId(item)) })),
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid draft ID." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: SecretAIMajorRevision;
  try {
    body = (await request.json()) as SecretAIMajorRevision;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    if (!body.draft || !Array.isArray(body.inlineComponents ?? [])) {
      throw new Error("The major revision must include a complete draft and inlineComponents list.");
    }
    const components = (body.inlineComponents ?? []).map((rawDraft) => ({
      id: randomUUID(),
      draft: addOwnedIds(rawDraft),
    }));
    const componentByName = new Map(
      components.map((component) => [component.draft.name.trim().toLocaleLowerCase(), component]),
    );
    if (componentByName.size !== components.length) throw new Error("Inline component names must be unique.");
    for (const component of components) {
      const errors = validateRecipeDraftPayload(component.draft);
      if (errors.length) throw new Error(`${component.draft.name}: ${errors[0].message}`);
    }

    const draft = addOwnedIds(body.draft);
    draft.items = draft.items.map((line) => {
      if (line.kind !== "recipe" || !line.proposedName) return line;
      const component = componentByName.get(line.proposedName.trim().toLocaleLowerCase());
      return component ? { ...line, nestedDraftId: component.id } : line;
    });
    for (const component of components) {
      if (!draft.items.some((line) => line.kind === "recipe" && line.nestedDraftId === component.id)) {
        throw new Error(`${draft.name}: inline component “${component.draft.name}” is not used by the parent recipe.`);
      }
    }
    const errors = validateRecipeDraftPayload(draft);
    if (errors.length) throw new Error(`${draft.name}: ${errors[0].message}`);

    const { data, error } = await supabase.rpc("import_major_recipe_revision", {
      target_draft_id: id,
      revision_payload: { draft, components },
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({
      draftPayload: draft,
      components: components.map((component) => ({ id: component.id, draftPayload: component.draft })),
      result: data,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Major revision could not be imported." },
      { status: 400 },
    );
  }
}
