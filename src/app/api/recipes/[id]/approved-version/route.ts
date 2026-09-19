import { createHash } from "crypto";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ItemInput = {
  kind?: string;
  sourceId?: string;
  quantity?: number;
  unit?: string;
  preparationNote?: string;
};

type StepInput = {
  instruction?: string;
};

export async function PUT(
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
    yieldKind?: string;
    baseYield?: number;
    yieldUnit?: string;
    minimumBatchQuantity?: number;
    minimumBatchUnit?: string;
    portionQuantity?: number | null;
    portionUnit?: string | null;
    chefNotes?: string;
    items?: ItemInput[];
    steps?: StepInput[];
  };

  const name = body.name?.trim();
  const items = body.items ?? [];
  const steps = body.steps ?? [];
  const baseYield = Number(body.baseYield);
  const minimumBatchQuantity = Number(body.minimumBatchQuantity);
  const portionQuantity =
    body.portionQuantity === null || body.portionQuantity === undefined
      ? null
      : Number(body.portionQuantity);

  if (
    !name ||
    !body.recipeType ||
    !body.yieldKind ||
    !body.yieldUnit ||
    !Number.isFinite(baseYield) ||
    baseYield <= 0 ||
    !Number.isFinite(minimumBatchQuantity) ||
    minimumBatchQuantity <= 0
  ) {
    return NextResponse.json({ error: "Recipe definition is incomplete." }, { status: 400 });
  }

  if (
    (portionQuantity !== null && (!Number.isFinite(portionQuantity) || portionQuantity <= 0)) ||
    ((portionQuantity === null) !== !body.portionUnit)
  ) {
    return NextResponse.json(
      { error: "Production portion needs both a positive quantity and a unit, or neither." },
      { status: 400 },
    );
  }

  if (
    items.length === 0 ||
    items.some((item) =>
      !["ingredient", "recipe"].includes(String(item.kind)) ||
      !item.sourceId ||
      !Number.isFinite(Number(item.quantity)) ||
      Number(item.quantity) <= 0 ||
      !item.unit
    )
  ) {
    return NextResponse.json({ error: "Every recipe item needs a source, quantity, and unit." }, { status: 400 });
  }

  if (steps.length === 0 || steps.some((step) => !step.instruction?.trim())) {
    return NextResponse.json({ error: "At least one complete preparation step is required." }, { status: 400 });
  }

  const { data: recipe, error: recipeError } = await supabaseAdmin
    .from("recipes")
    .select("id, current_approved_version_id")
    .eq("id", id)
    .maybeSingle();

  if (recipeError) {
    return NextResponse.json({ error: "Recipe could not be loaded: " + recipeError.message }, { status: 500 });
  }
  if (!recipe?.current_approved_version_id) {
    return NextResponse.json({ error: "This recipe does not have an approved version to edit." }, { status: 409 });
  }

  const previousVersionId = String(recipe.current_approved_version_id);

  const [
    versionNumberResult,
    previousVersionResult,
    equipmentResult,
    ingredientResult,
    componentResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("recipe_versions")
      .select("version_number")
      .eq("recipe_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("recipe_versions")
      .select("source_type, source_summary, production_notes")
      .eq("id", previousVersionId)
      .maybeSingle(),
    supabaseAdmin
      .from("recipe_version_equipment")
      .select("equipment_id, quantity, note, sort_order")
      .eq("recipe_version_id", previousVersionId)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("ingredients")
      .select("id")
      .in("id", items.filter((item) => item.kind === "ingredient").map((item) => String(item.sourceId))),
    supabaseAdmin
      .from("recipes")
      .select("id, current_approved_version_id")
      .in("id", items.filter((item) => item.kind === "recipe").map((item) => String(item.sourceId))),
  ]);

  const loadError =
    versionNumberResult.error ??
    previousVersionResult.error ??
    equipmentResult.error ??
    ingredientResult.error ??
    componentResult.error;
  if (loadError) {
    return NextResponse.json({ error: "Recipe dependencies could not be loaded: " + loadError.message }, { status: 500 });
  }

  const ingredientIds = new Set((ingredientResult.data ?? []).map((row) => String(row.id)));
  const componentVersions = new Map(
    (componentResult.data ?? []).map((row) => [
      String(row.id),
      row.current_approved_version_id ? String(row.current_approved_version_id) : "",
    ]),
  );

  for (const item of items) {
    if (item.kind === "ingredient" && !ingredientIds.has(String(item.sourceId))) {
      return NextResponse.json({ error: "One selected ingredient no longer exists." }, { status: 409 });
    }
    if (item.kind === "recipe" && !componentVersions.get(String(item.sourceId))) {
      return NextResponse.json({ error: "One selected component has no approved version." }, { status: 409 });
    }
  }

  const nextVersion = Number(versionNumberResult.data?.version_number ?? 0) + 1;
  const hashPayload = {
    name,
    recipeType: body.recipeType,
    yieldKind: body.yieldKind,
    baseYield,
    yieldUnit: body.yieldUnit,
    minimumBatchQuantity,
    minimumBatchUnit: body.minimumBatchUnit || body.yieldUnit,
    portionQuantity,
    portionUnit: body.portionUnit || null,
    chefNotes: body.chefNotes?.trim() || "",
    items,
    steps,
  };
  const contentHash = createHash("sha256").update(JSON.stringify(hashPayload)).digest("hex");

  const { data: newVersion, error: versionError } = await supabaseAdmin
    .from("recipe_versions")
    .insert({
      recipe_id: id,
      version_number: nextVersion,
      supersedes_version_id: previousVersionId,
      yield_kind: body.yieldKind,
      base_yield: baseYield,
      yield_unit: body.yieldUnit,
      minimum_batch_quantity: minimumBatchQuantity,
      minimum_batch_unit: body.minimumBatchUnit || body.yieldUnit,
      portion_quantity: portionQuantity,
      portion_unit: body.portionUnit || null,
      chef_notes: body.chefNotes?.trim() || null,
      production_notes: previousVersionResult.data?.production_notes ?? null,
      source_type: previousVersionResult.data?.source_type ?? "manual",
      source_summary: previousVersionResult.data?.source_summary ?? "Edited from approved recipe page",
      approved_by: user.id,
      content_hash: contentHash,
    })
    .select("id")
    .single();

  if (versionError || !newVersion) {
    return NextResponse.json({ error: "New approved version could not be created: " + (versionError?.message ?? "Unknown error") }, { status: 500 });
  }

  const newVersionId = String(newVersion.id);

  const versionItems = items.map((item, index) => ({
    recipe_version_id: newVersionId,
    item_kind: item.kind,
    ingredient_id: item.kind === "ingredient" ? item.sourceId : null,
    dependency_recipe_version_id:
      item.kind === "recipe" ? componentVersions.get(String(item.sourceId)) : null,
    quantity: Number(item.quantity),
    unit: item.unit,
    preparation_note: item.preparationNote?.trim() || null,
    sort_order: index,
  }));

  const { error: itemsError } = await supabaseAdmin
    .from("recipe_version_items")
    .insert(versionItems);

  if (itemsError) {
    await supabaseAdmin.from("recipe_versions").delete().eq("id", newVersionId);
    return NextResponse.json({ error: "Recipe items could not be saved: " + itemsError.message }, { status: 500 });
  }

  const versionSteps = steps.map((step, index) => ({
    recipe_version_id: newVersionId,
    step_number: index + 1,
    instruction: step.instruction?.trim(),
  }));

  const { error: stepsError } = await supabaseAdmin
    .from("recipe_version_steps")
    .insert(versionSteps);

  if (stepsError) {
    await supabaseAdmin.from("recipe_version_items").delete().eq("recipe_version_id", newVersionId);
    await supabaseAdmin.from("recipe_versions").delete().eq("id", newVersionId);
    return NextResponse.json({ error: "Recipe steps could not be saved: " + stepsError.message }, { status: 500 });
  }

  if ((equipmentResult.data ?? []).length > 0) {
    const { error: equipmentError } = await supabaseAdmin
      .from("recipe_version_equipment")
      .insert(
        (equipmentResult.data ?? []).map((row) => ({
          recipe_version_id: newVersionId,
          equipment_id: row.equipment_id,
          quantity: row.quantity,
          note: row.note,
          sort_order: row.sort_order,
        })),
      );
    if (equipmentError) {
      return NextResponse.json({ error: "Recipe saved, but equipment could not be copied: " + equipmentError.message }, { status: 500 });
    }
  }

  const { error: recipeUpdateError } = await supabaseAdmin
    .from("recipes")
    .update({
      name,
      recipe_type: body.recipeType,
      status: "complete",
      yield_kind: body.yieldKind,
      base_yield: baseYield,
      yield_unit: body.yieldUnit,
      minimum_batch: minimumBatchQuantity,
      notes: body.chefNotes?.trim() || null,
      current_approved_version_id: newVersionId,
      normalized_name: name.trim().replace(/\s+/gu, " ").toLocaleLowerCase(),
    })
    .eq("id", id);

  if (recipeUpdateError) {
    return NextResponse.json({ error: "Approved version was created, but recipe pointer could not be updated: " + recipeUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ id, versionId: newVersionId });
}


export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;

  const [
    recipeResult,
    itemResult,
    stepResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("recipes")
      .select("id, name, recipe_type, status, yield_kind, base_yield, yield_unit, minimum_batch, notes, current_approved_version_id")
      .eq("id", id)
      .maybeSingle(),
    supabaseAdmin
      .from("recipe_items")
      .select("item_type, ingredient_id, component_recipe_id, quantity, unit, preparation_note, sort_order")
      .eq("recipe_id", id)
      .order("sort_order", { ascending: true }),
    supabaseAdmin
      .from("recipe_steps")
      .select("instruction, step_number")
      .eq("recipe_id", id)
      .order("step_number", { ascending: true }),
  ]);

  const loadError = recipeResult.error ?? itemResult.error ?? stepResult.error;
  if (loadError) {
    return NextResponse.json({ error: "Draft recipe could not be loaded: " + loadError.message }, { status: 500 });
  }

  const recipe = recipeResult.data;
  if (!recipe) return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  if (recipe.current_approved_version_id) {
    return NextResponse.json({ error: "This recipe already has an approved version." }, { status: 409 });
  }

  const name = String(recipe.name ?? "").trim();
  const recipeType = String(recipe.recipe_type ?? "");
  const yieldKind = String(recipe.yield_kind ?? "");
  const yieldUnit = String(recipe.yield_unit ?? "");
  const baseYield = Number(recipe.base_yield);
  const minimumBatch = Number(recipe.minimum_batch);
  const items = itemResult.data ?? [];
  const steps = stepResult.data ?? [];

  if (
    !name ||
    !recipeType ||
    !yieldKind ||
    !yieldUnit ||
    !Number.isFinite(baseYield) ||
    baseYield <= 0 ||
    !Number.isFinite(minimumBatch) ||
    minimumBatch <= 0
  ) {
    return NextResponse.json(
      { error: "Finish the recipe name, type, yield, and minimum batch before approving it." },
      { status: 400 },
    );
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "Add at least one ingredient or component before approving." }, { status: 400 });
  }
  if (steps.length === 0 || steps.some((step) => !String(step.instruction ?? "").trim())) {
    return NextResponse.json({ error: "Add at least one complete preparation step before approving." }, { status: 400 });
  }

  const componentRecipeIds = items
    .filter((item) => item.item_type === "component")
    .map((item) => String(item.component_recipe_id ?? ""))
    .filter(Boolean);

  const { data: componentRecipes, error: componentError } = componentRecipeIds.length
    ? await supabaseAdmin
        .from("recipes")
        .select("id, current_approved_version_id")
        .in("id", componentRecipeIds)
    : { data: [], error: null };

  if (componentError) {
    return NextResponse.json({ error: "Component recipes could not be loaded: " + componentError.message }, { status: 500 });
  }

  const componentVersions = new Map(
    (componentRecipes ?? []).map((row) => [
      String(row.id),
      row.current_approved_version_id ? String(row.current_approved_version_id) : "",
    ]),
  );

  for (const item of items) {
    if (
      item.item_type === "component" &&
      !componentVersions.get(String(item.component_recipe_id ?? ""))
    ) {
      return NextResponse.json(
        { error: "Every component must have an approved recipe before this recipe can be approved." },
        { status: 409 },
      );
    }
  }

  const hashPayload = {
    name,
    recipeType,
    yieldKind,
    baseYield,
    yieldUnit,
    minimumBatch,
    notes: String(recipe.notes ?? ""),
    items,
    steps,
  };
  const contentHash = createHash("sha256").update(JSON.stringify(hashPayload)).digest("hex");

  const { data: version, error: versionError } = await supabaseAdmin
    .from("recipe_versions")
    .insert({
      recipe_id: id,
      version_number: 1,
      supersedes_version_id: null,
      yield_kind: yieldKind,
      base_yield: baseYield,
      yield_unit: yieldUnit,
      minimum_batch_quantity: minimumBatch,
      minimum_batch_unit: yieldUnit,
      portion_quantity: null,
      portion_unit: null,
      chef_notes: recipe.notes ? String(recipe.notes) : null,
      production_notes: null,
      source_type: "manual",
      source_summary: "Approved from legacy draft recipe",
      approved_by: user.id,
      content_hash: contentHash,
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return NextResponse.json(
      { error: "Approved version could not be created: " + (versionError?.message ?? "Unknown error") },
      { status: 500 },
    );
  }

  const versionId = String(version.id);

  const { error: itemsError } = await supabaseAdmin
    .from("recipe_version_items")
    .insert(
      items.map((item, index) => ({
        recipe_version_id: versionId,
        item_kind: item.item_type === "component" ? "recipe" : "ingredient",
        ingredient_id: item.item_type === "ingredient" ? item.ingredient_id : null,
        dependency_recipe_version_id:
          item.item_type === "component"
            ? componentVersions.get(String(item.component_recipe_id ?? "")) || null
            : null,
        quantity: Number(item.quantity),
        unit: item.unit,
        preparation_note: item.preparation_note,
        sort_order: index,
      })),
    );

  if (itemsError) {
    await supabaseAdmin.from("recipe_versions").delete().eq("id", versionId);
    return NextResponse.json({ error: "Approved recipe items could not be created: " + itemsError.message }, { status: 500 });
  }

  const { error: stepsError } = await supabaseAdmin
    .from("recipe_version_steps")
    .insert(
      steps.map((step, index) => ({
        recipe_version_id: versionId,
        step_number: index + 1,
        instruction: String(step.instruction).trim(),
      })),
    );

  if (stepsError) {
    await supabaseAdmin.from("recipe_version_items").delete().eq("recipe_version_id", versionId);
    await supabaseAdmin.from("recipe_versions").delete().eq("id", versionId);
    return NextResponse.json({ error: "Approved recipe steps could not be created: " + stepsError.message }, { status: 500 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("recipes")
    .update({
      status: "complete",
      current_approved_version_id: versionId,
      normalized_name: name.replace(/\s+/gu, " ").toLocaleLowerCase(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Approved version was created, but the recipe could not be marked complete: " + updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id, versionId });
}
