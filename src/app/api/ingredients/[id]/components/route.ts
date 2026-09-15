import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id: parentIngredientId } = await context.params;
  const body = (await request.json()) as {
    childIngredientId?: string;
    sourceText?: string;
  };
  const childIngredientId = body.childIngredientId?.trim();
  const sourceText = body.sourceText?.trim() || null;

  if (!childIngredientId) {
    return NextResponse.json({ error: "Child ingredient is required." }, { status: 400 });
  }
  if (childIngredientId === parentIngredientId) {
    return NextResponse.json({ error: "An ingredient cannot contain itself." }, { status: 400 });
  }

  const [{ data: parent, error: parentError }, { data: child, error: childError }] = await Promise.all([
    supabaseAdmin.from("ingredients").select("id, ingredient_kind").eq("id", parentIngredientId).maybeSingle(),
    supabaseAdmin.from("ingredients").select("id").eq("id", childIngredientId).maybeSingle(),
  ]);

  if (parentError || childError) {
    return NextResponse.json({ error: parentError?.message || childError?.message || "Ingredient lookup failed." }, { status: 500 });
  }
  if (!parent || !child) {
    return NextResponse.json({ error: "Ingredient not found." }, { status: 404 });
  }
  if (parent.ingredient_kind !== "compound") {
    return NextResponse.json({ error: "Only compound ingredients can contain child ingredients." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("ingredient_components")
    .select("sort_order")
    .eq("parent_ingredient_id", parentIngredientId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (existingError) {
    return NextResponse.json({ error: "Could not determine ingredient order: " + existingError.message }, { status: 500 });
  }

  const sortOrder = existing?.length ? Number(existing[0].sort_order ?? 0) + 1 : 0;
  const { data, error } = await supabaseAdmin
    .from("ingredient_components")
    .insert({
      parent_ingredient_id: parentIngredientId,
      child_ingredient_id: childIngredientId,
      sort_order: sortOrder,
      source_text: sourceText,
    })
    .select("id, parent_ingredient_id, child_ingredient_id, sort_order, quantity, unit, percentage, source_text")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Ingredient component could not be added: " + error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  await supabaseAdmin
    .from("ingredients")
    .update({ label_review_status: "unreviewed", label_reviewed_at: null, updated_at: new Date().toISOString() })
    .eq("id", parentIngredientId);

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id: parentIngredientId } = await context.params;
  const body = (await request.json()) as { componentId?: string };
  const componentId = body.componentId?.trim();

  if (!componentId) {
    return NextResponse.json({ error: "Component relationship is required." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("ingredient_components")
    .delete()
    .eq("id", componentId)
    .eq("parent_ingredient_id", parentIngredientId);

  if (error) {
    return NextResponse.json({ error: "Ingredient component could not be removed: " + error.message }, { status: 500 });
  }

  await supabaseAdmin
    .from("ingredients")
    .update({ label_review_status: "unreviewed", label_reviewed_at: null, updated_at: new Date().toISOString() })
    .eq("id", parentIngredientId);

  return NextResponse.json({ ok: true });
}
