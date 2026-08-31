import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RepairDataset = "sides" | "categories" | "proteinTypes";

type MergeRequest = {
  dataset?: RepairDataset;
  action?: "merge" | "remove";
  canonicalId?: string;
  canonicalName?: string;
  duplicateIds?: string[];
};

type MenuItemRow = {
  id: string;
  name: string;
  sides: string[] | null;
  category: string | null;
  protein_type: string | null;
};

const config = {
  sides: {
    table: "side_items",
    field: "sides",
  },
  categories: {
    table: "categories",
    field: "category",
  },
  proteinTypes: {
    table: "protein_types",
    field: "protein_type",
  },
} as const;

function uniqueNames(names: string[]) {
  const seen = new Set<string>();

  return names.filter((name) => {
    const key = name.trim().toLocaleLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: MergeRequest;

  try {
    body = (await request.json()) as MergeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const dataset = body.dataset;
  const canonicalId = body.canonicalId?.trim();
  const requestedCanonicalName = body.canonicalName?.trim();
  const duplicateIds = Array.from(
    new Set(
      (body.duplicateIds ?? [])
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter((id) => id && id !== canonicalId),
    ),
  );

  if (!dataset || !(dataset in config)) {
    return NextResponse.json(
      { error: "A repair dataset is required." },
      { status: 400 },
    );
  }

  const removing = body.action === "remove";

  if (removing && dataset !== "sides") {
    return NextResponse.json(
      { error: "Only side records can be removed completely." },
      { status: 400 },
    );
  }

  if (!removing && !canonicalId) {
    return NextResponse.json(
      { error: "A canonical value is required." },
      { status: 400 },
    );
  }

  if (duplicateIds.length === 0 && (!requestedCanonicalName || removing)) {
    return NextResponse.json(
      { error: "Select at least one duplicate to merge." },
      { status: 400 },
    );
  }

  const repairConfig = config[dataset];

  if (removing) {
    const { data: removalData, error: removalError } = await supabaseAdmin
      .from("side_items")
      .select("id, name")
      .in("id", duplicateIds);

    if (removalError || (removalData ?? []).length !== duplicateIds.length) {
      return NextResponse.json(
        { error: "One or more selected sides could not be loaded." },
        { status: 409 },
      );
    }

    const removalNames = new Set(
      (removalData ?? []).map((record) => String(record.name)),
    );
    const { data: menuData, error: menuError } = await supabaseAdmin
      .from("menu_items_v2")
      .select("id, name, sides, category, protein_type");

    if (menuError) {
      return NextResponse.json(
        { error: "Current menu-item references could not be loaded." },
        { status: 500 },
      );
    }

    const changedMenuItems: string[] = [];

    for (const item of (menuData ?? []) as MenuItemRow[]) {
      const currentSides = item.sides ?? [];

      if (!currentSides.some((side) => removalNames.has(side))) {
        continue;
      }

      const sides = currentSides.filter((side) => !removalNames.has(side));
      const { error } = await supabaseAdmin
        .from("menu_items_v2")
        .update({ sides })
        .eq("id", item.id);

      if (error) {
        return NextResponse.json(
          {
            error:
              "The removal stopped while updating " +
              item.name +
              ". No side records were deleted.",
          },
          { status: 500 },
        );
      }

      changedMenuItems.push(item.name);
    }

    for (const field of ["default_side_1_id", "default_side_2_id"]) {
      const { error: legacyError } = await supabaseAdmin
        .from("menu_items")
        .update({ [field]: null })
        .in(field, duplicateIds);

      if (legacyError) {
        return NextResponse.json(
          {
            error:
              "Current menu items were updated, but legacy " +
              field +
              " references could not be cleared. No side records were deleted: " +
              legacyError.message,
          },
          { status: 500 },
        );
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("side_items")
      .delete()
      .in("id", duplicateIds);

    if (deleteError) {
      return NextResponse.json(
        {
          error:
            "Menu-item references were cleared, but the side records could not be deleted: " +
            deleteError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      canonicalName: "Removed",
      mergedCount: duplicateIds.length,
      changedMenuItems,
    });
  }

  if (!canonicalId) {
    return NextResponse.json(
      { error: "A canonical value is required." },
      { status: 400 },
    );
  }

  const [
    { data: canonicalData, error: canonicalError },
    { data: duplicateData, error: duplicateError },
  ] = await Promise.all([
    supabaseAdmin
      .from(repairConfig.table)
      .select("id, name")
      .eq("id", canonicalId)
      .single(),
    supabaseAdmin
      .from(repairConfig.table)
      .select("id, name")
      .in("id", duplicateIds),
  ]);

  if (canonicalError || !canonicalData) {
    return NextResponse.json(
      { error: "The canonical value could not be found." },
      { status: 404 },
    );
  }

  if (duplicateError) {
    return NextResponse.json(
      { error: "The duplicate values could not be loaded." },
      { status: 500 },
    );
  }

  if ((duplicateData ?? []).length !== duplicateIds.length) {
    return NextResponse.json(
      { error: "One or more duplicate values no longer exist." },
      { status: 409 },
    );
  }

  const originalCanonicalName = String(canonicalData.name);
  let canonicalName = originalCanonicalName;

  if (requestedCanonicalName) {
    if (requestedCanonicalName !== originalCanonicalName) {
      const { error: renameError } = await supabaseAdmin
        .from(repairConfig.table)
        .update({ name: requestedCanonicalName })
        .eq("id", canonicalId);

      if (renameError) {
        return NextResponse.json(
          {
            error:
              'The canonical value could not be renamed to "' +
              requestedCanonicalName +
              '": ' +
              renameError.message,
          },
          { status: 409 },
        );
      }
    }

    canonicalName = requestedCanonicalName;
  }

  const duplicateNames = new Set(
    (duplicateData ?? []).map((record) => String(record.name)),
  );

  if (canonicalName !== originalCanonicalName) {
    duplicateNames.add(originalCanonicalName);
  }

  const { data: menuData, error: menuError } = await supabaseAdmin
    .from("menu_items_v2")
    .select("id, name, sides, category, protein_type");

  if (menuError) {
    return NextResponse.json(
      { error: "Current menu-item references could not be loaded." },
      { status: 500 },
    );
  }

  const changedMenuItems: string[] = [];

  for (const item of (menuData ?? []) as MenuItemRow[]) {
    if (repairConfig.field === "sides") {
      const currentSides = item.sides ?? [];

      if (!currentSides.some((side) => duplicateNames.has(side))) {
        continue;
      }

      const sides = uniqueNames(
        currentSides.map((side) =>
          duplicateNames.has(side) ? canonicalName : side,
        ),
      );
      const { error } = await supabaseAdmin
        .from("menu_items_v2")
        .update({ sides })
        .eq("id", item.id);

      if (error) {
        return NextResponse.json(
          {
            error:
              "The merge stopped while updating " +
              item.name +
              ". No duplicate records were removed.",
          },
          { status: 500 },
        );
      }

      changedMenuItems.push(item.name);
      continue;
    }

    const currentValue =
      repairConfig.field === "category" ? item.category : item.protein_type;

    if (!currentValue || !duplicateNames.has(currentValue)) {
      continue;
    }

    const update =
      repairConfig.field === "category"
        ? { category: canonicalName }
        : { protein_type: canonicalName };

    const { error } = await supabaseAdmin
      .from("menu_items_v2")
      .update(update)
      .eq("id", item.id);

    if (error) {
      return NextResponse.json(
        {
          error:
            "The merge stopped while updating " +
            item.name +
            ". No duplicate records were removed.",
        },
        { status: 500 },
      );
    }

    changedMenuItems.push(item.name);
  }

  const legacyFields =
    dataset === "sides"
      ? ["default_side_1_id", "default_side_2_id"]
      : dataset === "categories"
        ? ["category_id"]
        : ["protein_type_id"];

  for (const field of legacyFields) {
    const { error: legacyError } = await supabaseAdmin
      .from("menu_items")
      .update({ [field]: canonicalId })
      .in(field, duplicateIds);

    if (legacyError) {
      return NextResponse.json(
        {
          error:
            "Current menu items were updated, but legacy " +
            field +
            " references could not be repaired. No duplicate records were removed: " +
            legacyError.message,
        },
        { status: 500 },
      );
    }
  }

  const { error: deleteError } =
    duplicateIds.length > 0
      ? await supabaseAdmin
          .from(repairConfig.table)
          .delete()
          .in("id", duplicateIds)
      : { error: null };

  if (deleteError) {
    return NextResponse.json(
      {
        error:
          "Menu-item references were updated, but duplicate records could not be removed: " +
          deleteError.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    canonicalName,
    mergedCount: duplicateIds.length,
    changedMenuItems,
  });
}
