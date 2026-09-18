import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const measurementKinds = new Set(["liquid", "solid", "countable"]);
const ingredientKinds = new Set(["simple", "compound"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    measurementKind?: string;
    ingredientKind?: string;
    labelName?: string;
    ingredientStatement?: string;
    excludeFromShopping?: boolean;
  };
  const name = body.name?.trim();
  const measurementKind = body.measurementKind?.trim();
  const ingredientKind = body.ingredientKind?.trim();
  const labelName = body.labelName?.trim() ?? "";
  const ingredientStatement = body.ingredientStatement?.trim() ?? "";

  if (
    !name ||
    !measurementKind ||
    !ingredientKind ||
    !measurementKinds.has(measurementKind) ||
    !ingredientKinds.has(ingredientKind)
  ) {
    return NextResponse.json(
      { error: "Name, measurement type, and ingredient type are required." },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("ingredients")
    .select("ingredient_kind, label_name, ingredient_statement")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: "Ingredient could not be loaded: " + existingError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Ingredient not found." }, { status: 404 });
  }

  const update: Record<string, unknown> = {
    name,
    measurement_kind: measurementKind,
    ingredient_kind: ingredientKind,
    updated_at: new Date().toISOString(),
  };

  if (body.labelName !== undefined) update.label_name = labelName || null;
  if (body.ingredientStatement !== undefined) update.ingredient_statement = ingredientStatement || null;
  if (body.excludeFromShopping !== undefined) update.exclude_from_shopping = Boolean(body.excludeFromShopping);

  const declarationChanged = body.labelName !== undefined
    && (existing.label_name ?? "").trim() !== labelName;
  const statementChanged = body.ingredientStatement !== undefined
    && (existing.ingredient_statement ?? "").trim() !== ingredientStatement;
  const kindChanged = existing.ingredient_kind !== ingredientKind;

  if (declarationChanged || statementChanged || kindChanged) {
    update.label_review_status = "unreviewed";
    update.label_reviewed_at = null;
  }

  const { data, error } = await supabaseAdmin
    .from("ingredients")
    .update(update)
    .eq("id", id)
    .select("id, name, measurement_kind, ingredient_kind, label_name, ingredient_statement, label_review_status, exclude_from_shopping")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Ingredient could not be saved: " + error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json(data);
}
