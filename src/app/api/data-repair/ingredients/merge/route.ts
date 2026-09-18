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

  const { data: mergeData, error: mergeError } = await supabaseAdmin.rpc(
    "merge_ingredient_identity_everywhere",
    {
      canonical_ingredient_id: canonicalId,
      duplicate_ingredient_ids: duplicateIds,
      canonical_name: requestedCanonicalName || null,
    },
  );

  if (mergeError) {
    return NextResponse.json(
      {
        error:
          "Ingredient identity merge failed: " +
          mergeError.message,
      },
      { status: 500 },
    );
  }

  const result =
    mergeData && typeof mergeData === "object" && !Array.isArray(mergeData)
      ? (mergeData as Record<string, unknown>)
      : {};

  return NextResponse.json({
    canonicalName: String(result.canonicalName ?? canonicalName),
    mergedCount: Number(result.mergedCount ?? duplicateIds.length),
    changedRecipes: Array.isArray(result.changedRecipes)
      ? result.changedRecipes.map(String)
      : [],
  });

}
