import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const measurementKinds = new Set(["liquid", "solid", "countable"]);
const ingredientKinds = new Set(["simple", "compound"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    name?: string;
    measurementKind?: string;
    ingredientKind?: string;
  };
  const name = body.name?.trim();
  const measurementKind = body.measurementKind?.trim();
  const ingredientKind = body.ingredientKind?.trim() || "simple";

  if (
    !name ||
    !measurementKind ||
    !measurementKinds.has(measurementKind) ||
    !ingredientKinds.has(ingredientKind)
  ) {
    return NextResponse.json(
      { error: "Name, measurement type, and ingredient type are required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("ingredients")
    .insert({
      name,
      measurement_kind: measurementKind,
      ingredient_kind: ingredientKind,
    })
    .select("id, name, measurement_kind, ingredient_kind, label_name, ingredient_statement, label_review_status, active, notes")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("ingredients")
        .select("id, name, measurement_kind, ingredient_kind, label_name, ingredient_statement, label_review_status, active, notes")
        .ilike("name", name)
        .maybeSingle();

      if (!existingError && existing) {
        return NextResponse.json(existing, { status: 200 });
      }
    }

    return NextResponse.json(
      { error: "Ingredient could not be created: " + error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
