import { NextResponse } from "next/server";

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

  let body: { reviewBucket?: string };
  try {
    body = (await request.json()) as { reviewBucket?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.reviewBucket || !allowedBuckets.has(body.reviewBucket)) {
    return NextResponse.json({ error: "Invalid review destination." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("recipe_drafts")
    .update({ review_bucket: body.reviewBucket, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("draft_state", "ready_for_review")
    .select("id, review_bucket")
    .maybeSingle();

  if (error) {
    const forbidden = error.code === "42501";
    return NextResponse.json(
      { error: forbidden ? "Cookbook editor access is required." : error.message },
      { status: forbidden ? 403 : 400 },
    );
  }
  if (!data) return NextResponse.json({ error: "Reviewable draft not found." }, { status: 404 });

  return NextResponse.json({ id: data.id, reviewBucket: data.review_bucket });
}
