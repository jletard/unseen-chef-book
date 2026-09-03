import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { allergenLabels, type AllergenKey } from "@/lib/labeling-types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json() as {
    labelName?: string;
    ingredientStatement?: string;
    allergenKeys?: string[];
    allergenDetails?: Record<string, string>;
    dietaryFlags?: string[];
    confirmed?: boolean;
  };
  const keys = Array.from(new Set(body.allergenKeys ?? []));
  const dietaryFlags = Array.from(new Set(body.dietaryFlags ?? []));
  if (keys.some((key) => !(key in allergenLabels))) {
    return NextResponse.json({ error: "Unknown allergen." }, { status: 400 });
  }
  if (dietaryFlags.some((key) => key !== "vegetarian")) {
    return NextResponse.json({ error: "Unknown dietary flag." }, { status: 400 });
  }
  const labelName = body.labelName?.trim();
  const ingredientStatement = body.ingredientStatement?.trim();
  if (!labelName || !ingredientStatement) {
    return NextResponse.json({ error: "Label name and ingredient statement are required." }, { status: 400 });
  }

  const details = Object.fromEntries(
    keys.flatMap((key) => {
      const value = body.allergenDetails?.[key]?.trim();
      return value ? [[key, value]] : [];
    }),
  );
  const { error } = await supabaseAdmin.from("ingredients").update({
    label_name: labelName,
    ingredient_statement: ingredientStatement,
    allergen_keys: keys as AllergenKey[],
    allergen_details: details,
    dietary_flags: dietaryFlags,
    label_review_status: body.confirmed ? "confirmed" : "unreviewed",
    label_reviewed_at: body.confirmed ? new Date().toISOString() : null,
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
