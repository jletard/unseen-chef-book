import { NextResponse } from "next/server";

import { allergenLabels, type AllergenKey } from "@/lib/labeling-types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const measurementKinds = new Set(["liquid", "solid", "countable"]);
const ingredientKinds = new Set(["simple", "compound"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const writeBatchSize = 20;

type ReviewUpdate = {
  id?: string;
  name?: string;
  measurementKind?: string;
  ingredientKind?: string;
  labelName?: string;
  ingredientStatement?: string;
  allergenKeys?: string[];
  allergenDetails?: Record<string, string>;
  dietaryFlags?: string[];
  excludeFromShopping?: boolean;
  confirmed?: boolean;
};

function validate(update: ReviewUpdate) {
  const id = update.id ?? "";
  const name = update.name?.trim() ?? "";
  const measurementKind = update.measurementKind?.trim() ?? "";
  const ingredientKind = update.ingredientKind?.trim() ?? "";
  const labelName = update.labelName?.trim() ?? "";
  const ingredientStatement = update.ingredientStatement?.trim() ?? "";
  const allergenKeys = Array.from(new Set(update.allergenKeys ?? []));
  const dietaryFlags = Array.from(new Set(update.dietaryFlags ?? []));

  if (!uuidPattern.test(id)) throw new Error("An ingredient ID is invalid.");
  if (!name || !measurementKinds.has(measurementKind) || !ingredientKinds.has(ingredientKind)) {
    throw new Error(`Name, measurement type, and ingredient type are required for ${name || id}.`);
  }
  if (!labelName || !ingredientStatement) {
    throw new Error(`Label name and ingredient statement are required for ${name}.`);
  }
  if (allergenKeys.some((key) => !(key in allergenLabels))) {
    throw new Error(`Unknown allergen for ${name}.`);
  }
  if (dietaryFlags.some((key) => key !== "vegetarian")) {
    throw new Error(`Unknown dietary flag for ${name}.`);
  }

  const allergenDetails = Object.fromEntries(
    allergenKeys.flatMap((key) => {
      const value = update.allergenDetails?.[key]?.trim();
      return value ? [[key, value]] : [];
    }),
  );

  return {
    id,
    name,
    values: {
      name,
      measurement_kind: measurementKind,
      ingredient_kind: ingredientKind,
      label_name: labelName,
      ingredient_statement: ingredientStatement,
      allergen_keys: allergenKeys as AllergenKey[],
      allergen_details: allergenDetails,
      dietary_flags: dietaryFlags,
      exclude_from_shopping: Boolean(update.excludeFromShopping),
      label_review_status: update.confirmed === false ? "unreviewed" : "confirmed",
      label_reviewed_at: update.confirmed === false ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json() as { updates?: ReviewUpdate[] };
    if (!Array.isArray(body.updates) || body.updates.length === 0 || body.updates.length > 500) {
      return NextResponse.json({ error: "Submit between 1 and 500 ingredient updates." }, { status: 400 });
    }

    const updates = body.updates.map(validate);
    if (new Set(updates.map((update) => update.id)).size !== updates.length) {
      return NextResponse.json({ error: "Each ingredient may appear only once." }, { status: 400 });
    }

    let savedCount = 0;
    for (let index = 0; index < updates.length; index += writeBatchSize) {
      const results = await Promise.all(
        updates.slice(index, index + writeBatchSize).map((update) =>
          supabaseAdmin
            .from("ingredients")
            .update(update.values)
            .eq("id", update.id)
            .select("id")
            .single(),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw new Error(`Saved ${savedCount} ingredients before a database error: ${failed.error.message}`);
      }
      savedCount += results.length;
    }

    return NextResponse.json({ savedCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk ingredient review save failed." },
      { status: 500 },
    );
  }
}
