import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const units = new Set([
  "serving",
  "each",
  "tsp",
  "tbsp",
  "fl_oz",
  "cup",
  "quart",
  "g",
  "kg",
]);

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    quantity?: number;
    unit?: string;
    preparationNote?: string | null;
  };
  const name = body.name?.trim();
  const quantity = Number(body.quantity);
  const unit = body.unit?.trim();

  if (!name || !Number.isFinite(quantity) || quantity <= 0 || !unit || !units.has(unit)) {
    return NextResponse.json(
      { error: "Name, positive quantity, and valid unit are required." },
      { status: 400 },
    );
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from("recipe_items")
    .select("item_type, ingredient_id, component_recipe_id")
    .eq("id", id)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Recipe line was not found." }, { status: 404 });
  }

  const sourceUpdate =
    item.item_type === "ingredient" && item.ingredient_id
      ? await supabaseAdmin
          .from("ingredients")
          .update({ name })
          .eq("id", item.ingredient_id)
      : item.item_type === "component" && item.component_recipe_id
        ? await supabaseAdmin
            .from("recipes")
            .update({ name })
            .eq("id", item.component_recipe_id)
        : { error: new Error("Recipe line has no source record.") };

  if (sourceUpdate.error) {
    const sourceError = sourceUpdate.error;
    return NextResponse.json(
      { error: "Name could not be saved: " + sourceError.message },
      { status: "code" in sourceError && sourceError.code === "23505" ? 409 : 500 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("recipe_items")
    .update({
      quantity,
      unit,
      preparation_note: body.preparationNote?.trim() || null,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Recipe line could not be saved: " + error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await supabaseAdmin.from("recipe_items").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Item could not be removed: " + error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
