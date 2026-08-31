import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const units = new Set(["serving", "each", "tsp", "tbsp", "fl_oz", "cup", "quart", "g", "kg"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as {
    itemType?: "ingredient" | "component";
    sourceId?: string;
    quantity?: number;
    unit?: string;
    preparationNote?: string;
  };
  const quantity = Number(body.quantity);

  if (
    !body.sourceId ||
    !body.itemType ||
    !["ingredient", "component"].includes(body.itemType) ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !body.unit ||
    !units.has(body.unit)
  ) {
    return NextResponse.json({ error: "Item, quantity, and unit are required." }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from("recipe_items")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", id);

  const { data, error } = await supabaseAdmin
    .from("recipe_items")
    .insert({
      recipe_id: id,
      item_type: body.itemType,
      ingredient_id: body.itemType === "ingredient" ? body.sourceId : null,
      component_recipe_id: body.itemType === "component" ? body.sourceId : null,
      quantity,
      unit: body.unit,
      preparation_note: body.preparationNote?.trim() || null,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Recipe item could not be added: " + error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
