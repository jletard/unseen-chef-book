import { NextResponse } from "next/server";

import { validateRecipeDraftPayload } from "@/lib/cookbook-v2/domain";
import { createClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedBuckets = new Set(["unreviewed", "needs_classification", "minor", "major", "ready"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid draft ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: { reviewBucket?: string; draftPayload?: unknown };
  try {
    body = (await request.json()) as { reviewBucket?: string; draftPayload?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (body.reviewBucket !== undefined && !allowedBuckets.has(body.reviewBucket)) {
    return NextResponse.json({ error: "Invalid review destination." }, { status: 400 });
  }
  if (body.reviewBucket === undefined && body.draftPayload === undefined) {
    return NextResponse.json({ error: "No draft changes were supplied." }, { status: 400 });
  }
  if (body.draftPayload !== undefined) {
    const validationErrors = validateRecipeDraftPayload(body.draftPayload);
    if (validationErrors.length) {
      return NextResponse.json(
        { error: `${validationErrors[0].path}: ${validationErrors[0].message}` },
        { status: 400 },
      );
    }
  }

  const changes: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  if (body.reviewBucket !== undefined) changes.review_bucket = body.reviewBucket;
  if (body.draftPayload !== undefined) changes.draft_payload = body.draftPayload;

  const { data, error } = await supabase
    .from("recipe_drafts")
    .update(changes)
    .eq("id", id)
    .eq("draft_state", "ready_for_review")
    .select("id, review_bucket, draft_payload")
    .maybeSingle();

  if (error) {
    const forbidden = error.code === "42501";
    return NextResponse.json(
      { error: forbidden ? "Cookbook editor access is required." : error.message },
      { status: forbidden ? 403 : 400 },
    );
  }
  if (!data) return NextResponse.json({ error: "Reviewable draft not found." }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    reviewBucket: data.review_bucket,
    draftPayload: data.draft_payload,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid draft ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data, error } = await supabase
    .from("recipe_drafts")
    .update({
      draft_state: "archived",
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("draft_state", "ready_for_review")
    .select("id")
    .maybeSingle();

  if (error) {
    const forbidden = error.code === "42501";
    return NextResponse.json(
      { error: forbidden ? "Cookbook editor access is required." : error.message },
      { status: forbidden ? 403 : 400 },
    );
  }
  if (!data) return NextResponse.json({ error: "Reviewable draft not found." }, { status: 404 });

  return NextResponse.json({ id: data.id, archived: true });
}
