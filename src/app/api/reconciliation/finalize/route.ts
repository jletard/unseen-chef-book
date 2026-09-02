import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type DraftRow = {
  id: string;
  draft_payload: Record<string, unknown>;
  generation_metadata: Record<string, unknown> | null;
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

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
      .select("id, normalized_name, current_approved_version_id")
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
    if (!row.normalized_name || !row.current_approved_version_id) continue;
    approvedRecipes.set(row.normalized_name, (approvedRecipes.get(row.normalized_name) ?? 0) + 1);
  }

  const newIngredients = new Set<string>();
  const ambiguousIngredients = new Set<string>();
  const dependencyBlockers = new Set<string>();
  for (const draft of drafts) {
    for (const item of recipeItems(draft)) {
      const proposedName = typeof item.proposedName === "string" ? item.proposedName.trim() : "";
      if (!proposedName) continue;
      if (item.kind === "ingredient") {
        const matches = ingredientMatches.get(normalize(proposedName));
        if (!matches?.size) newIngredients.add(proposedName);
        if ((matches?.size ?? 0) > 1) ambiguousIngredients.add(proposedName);
      } else if (item.kind === "recipe") {
        const nestedDraftId = typeof item.nestedDraftId === "string" ? item.nestedDraftId : "";
        if (nestedDraftId) continue;
        if (!nestedDraftId && (approvedRecipes.get(normalize(proposedName)) ?? 0) === 1) continue;
        dependencyBlockers.add(proposedName);
      }
    }
  }

  return {
    drafts,
    preview: {
      readyCount: drafts.length,
      newIngredients: Array.from(newIngredients).sort(),
      ambiguousIngredients: Array.from(ambiguousIngredients).sort(),
      dependencyBlockers: Array.from(dependencyBlockers).sort(),
    },
  };
}

function dependencyOrder(drafts: DraftRow[]) {
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  const result: DraftRow[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(draft: DraftRow) {
    if (visited.has(draft.id)) return;
    if (visiting.has(draft.id)) throw new Error("Draft component dependency cycle detected.");
    visiting.add(draft.id);
    for (const item of recipeItems(draft)) {
      if (item.kind !== "recipe" || typeof item.nestedDraftId !== "string") continue;
      const dependency = byId.get(item.nestedDraftId);
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
    if (preview.ambiguousIngredients.length || preview.dependencyBlockers.length) {
      return NextResponse.json(
        { error: "Resolve ambiguous ingredients and component blockers before finalizing.", preview },
        { status: 409 },
      );
    }
    const finalized: unknown[] = [];
    for (const draft of dependencyOrder(drafts)) {
      const { data, error } = await supabase.rpc("finalize_ready_recipe_draft", {
        ready_draft_id: draft.id,
      });
      if (error) throw new Error(error.message);
      finalized.push(data);
    }
    return NextResponse.json({ finalizedCount: finalized.length, finalized });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ready drafts could not be finalized." },
      { status: 400 },
    );
  }
}
