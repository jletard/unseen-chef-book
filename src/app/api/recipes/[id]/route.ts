import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const recipeTypes = new Set([
  "main", "side", "component", "sauce", "dressing",
  "dessert", "bread", "other",
]);
const statuses = new Set(["draft", "complete", "inactive"]);
const yieldKinds = new Set(["servings", "liquid", "solid", "countable"]);
const yieldUnits = new Set(["serving", "each", "fl_oz", "cup", "quart", "g", "kg"]);

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
    recipeType?: string;
    status?: string;
    yieldKind?: string | null;
    baseYield?: number | null;
    yieldUnit?: string | null;
    minimumBatch?: number | null;
    notes?: string | null;
  };

  const name = body.name?.trim();
  if (!name || !body.recipeType || !recipeTypes.has(body.recipeType)) {
    return NextResponse.json({ error: "Recipe name and type are required." }, { status: 400 });
  }
  if (!body.status || !statuses.has(body.status)) {
    return NextResponse.json({ error: "A valid recipe status is required." }, { status: 400 });
  }
  if (body.yieldKind && !yieldKinds.has(body.yieldKind)) {
    return NextResponse.json({ error: "Invalid yield type." }, { status: 400 });
  }
  if (body.yieldUnit && !yieldUnits.has(body.yieldUnit)) {
    return NextResponse.json({ error: "Invalid yield unit." }, { status: 400 });
  }

  const baseYield =
    body.baseYield === null || body.baseYield === undefined
      ? null
      : Number(body.baseYield);
  const minimumBatch =
    body.minimumBatch === null || body.minimumBatch === undefined
      ? null
      : Number(body.minimumBatch);

  if (body.status === "complete") {
    const [{ count: itemCount }, { count: stepCount }] = await Promise.all([
      supabaseAdmin.from("recipe_items").select("id", { count: "exact", head: true }).eq("recipe_id", id),
      supabaseAdmin.from("recipe_steps").select("id", { count: "exact", head: true }).eq("recipe_id", id),
    ]);

    if (!body.yieldKind || !body.yieldUnit || !baseYield || !itemCount || !stepCount) {
      return NextResponse.json(
        { error: "A complete recipe needs a yield, at least one recipe item, and at least one preparation step." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("recipes")
    .update({
      name,
      recipe_type: body.recipeType,
      status: body.status,
      yield_kind: body.yieldKind || null,
      base_yield: baseYield,
      yield_unit: body.yieldUnit || null,
      minimum_batch: minimumBatch,
      notes: body.notes?.trim() || null,
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Recipe could not be saved: " + error.message }, { status: error.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json(data);
}
