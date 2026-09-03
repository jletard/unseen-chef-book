import { NextResponse } from "next/server";

import { allergenLabels, type AllergenKey } from "@/lib/labeling-types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type LabelingUpdate = {
  id?: string;
  labelName?: string;
  ingredientStatement?: string;
  allergenKeys?: string[];
  allergenDetails?: Record<string, string>;
  dietaryFlags?: string[];
  confirmed?: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const writeBatchSize = 20;

function validatedUpdate(update: LabelingUpdate) {
  const keys = Array.from(new Set(update.allergenKeys ?? []));
  const dietaryFlags = Array.from(new Set(update.dietaryFlags ?? []));
  const labelName = update.labelName?.trim();
  const ingredientStatement = update.ingredientStatement?.trim();
  if (!update.id || !uuidPattern.test(update.id)) throw new Error("An ingredient ID is invalid.");
  if (!labelName || !ingredientStatement) throw new Error("Label name and ingredient statement are required.");
  if (keys.some((key) => !(key in allergenLabels))) throw new Error(`Unknown allergen for ${labelName}.`);
  if (dietaryFlags.some((key) => key !== "vegetarian")) throw new Error(`Unknown dietary flag for ${labelName}.`);
  const details = Object.fromEntries(
    keys.flatMap((key) => {
      const value = update.allergenDetails?.[key]?.trim();
      return value ? [[key, value]] : [];
    }),
  );
  return {
    id: update.id,
    values: {
      label_name: labelName,
      ingredient_statement: ingredientStatement,
      allergen_keys: keys as AllergenKey[],
      allergen_details: details,
      dietary_flags: dietaryFlags,
      label_review_status: update.confirmed ? "confirmed" : "unreviewed",
      label_reviewed_at: update.confirmed ? new Date().toISOString() : null,
    },
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json() as { updates?: LabelingUpdate[] };
    if (!Array.isArray(body.updates) || body.updates.length === 0 || body.updates.length > 500) {
      return NextResponse.json({ error: "Submit between 1 and 500 ingredient updates." }, { status: 400 });
    }
    const updates = body.updates.map(validatedUpdate);
    if (new Set(updates.map((update) => update.id)).size !== updates.length) {
      return NextResponse.json({ error: "Each ingredient may appear only once." }, { status: 400 });
    }

    let savedCount = 0;
    for (let index = 0; index < updates.length; index += writeBatchSize) {
      const results = await Promise.all(
        updates.slice(index, index + writeBatchSize).map((update) =>
          supabaseAdmin.from("ingredients").update(update.values).eq("id", update.id).select("id").single(),
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
      { error: error instanceof Error ? error.message : "Bulk allergen save failed." },
      { status: 500 },
    );
  }
}
