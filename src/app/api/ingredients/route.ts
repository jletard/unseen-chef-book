import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const kinds = new Set(["liquid", "solid", "countable"]);

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
  };
  const name = body.name?.trim();
  const measurementKind = body.measurementKind?.trim();

  if (!name || !measurementKind || !kinds.has(measurementKind)) {
    return NextResponse.json(
      { error: "Name and measurement type are required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("ingredients")
    .insert({
      name,
      measurement_kind: measurementKind,
    })
    .select("id, name, measurement_kind, active, notes")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Ingredient could not be created: " + error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
