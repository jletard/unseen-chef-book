import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { normalizeCookbookName } from "@/lib/cookbook-v2/normalize-name";

type DraftRow = {
  id: string;
  draft_payload: Record<string, unknown>;
  generation_metadata: Record<string, unknown> | null;
};

function recipeItems(draft: DraftRow) {
  return Array.isArray(draft.draft_payload.items)
    ? draft.draft_payload.items as Array<Record<string, unknown>>
    : [];
}

async function loadFinalizationPreview(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [draftResult, ingredientResult, aliasResult, recipeResult] = await Promise.all([
    supabase
      .from("recipe_drafts")
      .select("id, draft_payload, generation_metadata")
      .eq("draft_state", "ready_for_review")
      .eq("review_bucket", "ready"),
    supabase.from("ingredients").select("id, normalized_name").is("retired_at", null),
    supabase.from("ingredient_aliases").select("ingredient_id, normalized_alias"),
    supabase
      .from("recipes")
      .select("id, name, normalized_name, current_approved_version_id")
      .is("retired_at", null),
  ]);
  const error = draftResult.error ?? ingredientResult.error ?? aliasResult.error ?? recipeResult.error;
  if (error) throw new Error(error.message);

  const drafts = (draftResult.data ?? []) as DraftRow[];
  const ingredientMatches = new Map<string, Set<string>>();
  for (const row of ingredientResult.data ?? []) {
    if (!row.normalized_name) continue;
    const matches = ingredientMatches.get(row.normalized_name) ?? new Set<string>();
    matches.add(row.id);
    ingredientMatches.set(row.normalized_name, matches);
  }
  for (const row of aliasResult.data ?? []) {
    const matches = ingredientMatches.get(row.normalized_alias) ?? new Set<string>();
    matches.add(row.ingredient_id);
    ingredientMatches.set(row.normalized_alias, matches);
  }
  const approvedRecipes = new Map<string, number>();
  for (const row of recipeResult.data ?? []) {
    if (!row.current_approved_version_id) continue;
    const normalizedName = normalizeCookbookName(row.name);
    approvedRecipes.set(normalizedName, (approvedRecipes.get(normalizedName) ?? 0) + 1);
  }
  const readyRecipes = new Map<string, number>();
  for (const draft of drafts) {
    const name = typeof draft.draft_payload.name === "string" ? normalizeCookbookName(draft.draft_payload.name) : "";
    if (!name) continue;
    readyRecipes.set(name, (readyRecipes.get(name) ?? 0) + 1);
  }

  const newIngredients = new Set<string>();
  const ambiguousIngredients = new Set<string>();
  const dependencyBlockers = new Set<string>();
  const ambiguousComponents = new Set<string>();
  for (const draft of drafts) {
    for (const item of recipeItems(draft)) {
      const proposedName = typeof item.proposedName === "string" ? item.proposedName.trim() : "";
      if (!proposedName) continue;
      if (item.kind === "ingredient") {
        const matches = ingredientMatches.get(normalizeCookbookName(proposedName));
        if (!matches?.size) newIngredients.add(proposedName);
        if ((matches?.size ?? 0) > 1) ambiguousIngredients.add(proposedName);
      } else if (item.kind === "recipe") {
        const nestedDraftId = typeof item.nestedDraftId === "string" ? item.nestedDraftId : "";
        if (nestedDraftId) continue;
        const approvedCount = approvedRecipes.get(normalizeCookbookName(proposedName)) ?? 0;
        const readyCount = readyRecipes.get(normalizeCookbookName(proposedName)) ?? 0;
        if (!nestedDraftId && approvedCount === 1) continue;
        if (!nestedDraftId && approvedCount === 0 && readyCount === 1) continue;
        if (approvedCount > 1 || readyCount > 1) ambiguousComponents.add(proposedName);
        else dependencyBlockers.add(proposedName);
      }
    }
  }

  return {
    drafts,
    preview: {
      readyCount: drafts.length,
      newIngredients: Array.from(newIngredients).sort(),
      ambiguousIngredients: Array.from(ambiguousIngredients).sort(),
      ambiguousComponents: Array.from(ambiguousComponents).sort(),
      dependencyBlockers: Array.from(dependencyBlockers).sort(),
    },
  };
}

function dependencyOrder(drafts: DraftRow[]) {
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  const byName = new Map<string, DraftRow[]>();
  for (const draft of drafts) {
    const name = typeof draft.draft_payload.name === "string" ? normalizeCookbookName(draft.draft_payload.name) : "";
    if (!name) continue;
    byName.set(name, [...(byName.get(name) ?? []), draft]);
  }
  const result: DraftRow[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(draft: DraftRow) {
    if (visited.has(draft.id)) return;
    if (visiting.has(draft.id)) throw new Error("Draft component dependency cycle detected.");
    visiting.add(draft.id);
    for (const item of recipeItems(draft)) {
      if (item.kind !== "recipe") continue;
      const nestedDraftId = typeof item.nestedDraftId === "string" ? item.nestedDraftId : "";
      const proposedName = typeof item.proposedName === "string" ? normalizeCookbookName(item.proposedName) : "";
      const namedCandidates = proposedName ? byName.get(proposedName) ?? [] : [];
      const dependency = nestedDraftId
        ? byId.get(nestedDraftId)
        : namedCandidates.length === 1
          ? namedCandidates[0]
          : undefined;
      if (dependency?.id === draft.id) continue;
      if (dependency) visit(dependency);
    }
    visiting.delete(draft.id);
    visited.add(draft.id);
    result.push(draft);
  }
  drafts
    .slice()
    .sort((left, right) => {
      const leftInline = left.generation_metadata?.inline_component === true ? 0 : 1;
      const rightInline = right.generation_metadata?.inline_component === true ? 0 : 1;
      return leftInline - rightInline;
    })
    .forEach(visit);
  return result;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { preview } = await loadFinalizationPreview(supabase);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Finalization preview failed." },
      { status: 400 },
    );
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const { drafts, preview } = await loadFinalizationPreview(supabase);
    if (preview.ambiguousIngredients.length || preview.ambiguousComponents.length || preview.dependencyBlockers.length) {
      return NextResponse.json(
        { error: "Resolve ambiguous ingredients and component blockers before finalizing.", preview },
        { status: 409 },
      );
    }
    const orderedDrafts = dependencyOrder(drafts);
    const { data, error } = await supabase.rpc("finalize_ready_recipe_drafts", {
      ready_draft_ids: orderedDrafts.map((draft) => draft.id),
    });
    if (error) throw new Error(error.message);
    const finalized = Array.isArray(data) ? data : [];
    return NextResponse.json({ finalizedCount: finalized.length, finalized });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ready drafts could not be finalized." },
      { status: 400 },
    );
  }
}
