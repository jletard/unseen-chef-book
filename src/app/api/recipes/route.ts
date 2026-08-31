import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const recipeTypes = new Set([
  "main",
  "side",
  "component",
  "sauce",
  "dressing",
  "dessert",
  "bread",
  "other",
]);

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
    recipeType?: string;
  };
  const name = body.name?.trim();
  const recipeType = body.recipeType?.trim();

  if (!name || !recipeType || !recipeTypes.has(recipeType)) {
    return NextResponse.json(
      { error: "Name and recipe type are required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("recipes")
    .insert({
      name,
      recipe_type: recipeType,
      status: "draft",
    })
    .select(
      "id, name, recipe_type, status, yield_kind, base_yield, yield_unit, minimum_batch, notes",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Recipe could not be created: " + error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
