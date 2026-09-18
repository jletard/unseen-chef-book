import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type MergeRequest = {
  canonicalId?: string;
  canonicalName?: string;
  duplicateIds?: string[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: MergeRequest;

  try {
    body = (await request.json()) as MergeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const canonicalId = body.canonicalId?.trim();
  const requestedCanonicalName = body.canonicalName?.trim();
  const duplicateIds = Array.from(
    new Set(
      (body.duplicateIds ?? [])
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id && id !== canonicalId),
    ),
  );

  if (!canonicalId) {
    return NextResponse.json(
      { error: "A canonical ingredient is required." },
      { status: 400 },
    );
  }

  if (duplicateIds.length === 0 && !requestedCanonicalName) {
    return NextResponse.json(
      { error: "Select at least one duplicate or enter a corrected name." },
      { status: 400 },
    );
  }

  const [
    { data: canonicalData, error: canonicalError },
    { data: duplicateData, error: duplicateError },
  ] = await Promise.all([
    supabaseAdmin
      .from("ingredients")
      .select("id, name")
      .eq("id", canonicalId)
      .single(),
    duplicateIds.length > 0
      ? supabaseAdmin
          .from("ingredients")
          .select("id, name")
          .in("id", duplicateIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (canonicalError || !canonicalData) {
    return NextResponse.json(
      { error: "The canonical ingredient could not be found." },
      { status: 404 },
    );
  }

  if (duplicateError) {
    return NextResponse.json(
      { error: "The duplicate ingredients could not be loaded." },
      { status: 500 },
    );
  }

  if ((duplicateData ?? []).length !== duplicateIds.length) {
    return NextResponse.json(
      { error: "One or more duplicate ingredients no longer exist." },
      { status: 409 },
    );
  }

  const originalCanonicalName = String(canonicalData.name);
  const canonicalName = requestedCanonicalName || originalCanonicalName;

  if (
    requestedCanonicalName &&
    requestedCanonicalName !== originalCanonicalName
  ) {
    const { error: renameError } = await supabaseAdmin
      .from("ingredients")
      .update({ name: requestedCanonicalName })
      .eq("id", canonicalId);

    if (renameError) {
      return NextResponse.json(
        {
          error:
            'The ingredient could not be renamed to "' +
            requestedCanonicalName +
            '": ' +
            renameError.message,
        },
        { status: 409 },
      );
    }
  }

  let changedRecipes: string[] = [];

  if (duplicateIds.length > 0) {
    const [
      { data: legacyUsageData, error: legacyUsageError },
      { data: versionUsageData, error: versionUsageError },
    ] = await Promise.all([
      supabaseAdmin
        .from("recipe_items")
        .select("recipe_id")
        .eq("item_type", "ingredient")
        .in("ingredient_id", duplicateIds),
      supabaseAdmin
        .from("recipe_version_items")
        .select("recipe_version_id")
        .eq("item_kind", "ingredient")
        .in("ingredient_id", duplicateIds),
    ]);

    const usageError = legacyUsageError ?? versionUsageError;
    if (usageError) {
      return NextResponse.json(
        { error: "Recipe ingredient references could not be loaded." },
        { status: 500 },
      );
    }

    const recipeIds = new Set(
      (legacyUsageData ?? []).map((row) => String(row.recipe_id)),
    );

    const versionIds = Array.from(
      new Set((versionUsageData ?? []).map((row) => String(row.recipe_version_id))),
    );

    if (versionIds.length > 0) {
      const { data: versionRecipes, error: versionRecipeError } = await supabaseAdmin
        .from("recipe_versions")
        .select("recipe_id")
        .in("id", versionIds);

      if (versionRecipeError) {
        return NextResponse.json(
          { error: "Approved recipe references could not be resolved." },
          { status: 500 },
        );
      }

      for (const row of versionRecipes ?? []) {
        if (row.recipe_id) recipeIds.add(String(row.recipe_id));
      }
    }

    const [
      { error: legacyUpdateError },
      { error: versionUpdateError },
    ] = await Promise.all([
      supabaseAdmin
        .from("recipe_items")
        .update({ ingredient_id: canonicalId })
        .eq("item_type", "ingredient")
        .in("ingredient_id", duplicateIds),
      supabaseAdmin
        .from("recipe_version_items")
        .update({ ingredient_id: canonicalId })
        .eq("item_kind", "ingredient")
        .in("ingredient_id", duplicateIds),
    ]);

    const updateError = legacyUpdateError ?? versionUpdateError;
    if (updateError) {
      return NextResponse.json(
        {
          error:
            "The ingredient merge stopped while updating recipe references. No duplicate ingredients were deleted: " +
            updateError.message,
        },
        { status: 500 },
      );
    }

    if (recipeIds.size > 0) {
      const { data: recipeData, error: recipeError } = await supabaseAdmin
        .from("recipes")
        .select("id, name")
        .in("id", Array.from(recipeIds));

      if (!recipeError) {
        changedRecipes = (recipeData ?? [])
          .map((row) => String(row.name))
          .sort((a, b) => a.localeCompare(b));
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("ingredients")
      .delete()
      .in("id", duplicateIds);

    if (deleteError) {
      return NextResponse.json(
        {
          error:
            "Recipe references were updated, but duplicate ingredients could not be deleted: " +
            deleteError.message,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    canonicalName,
    mergedCount: duplicateIds.length,
    changedRecipes,
  });
}
