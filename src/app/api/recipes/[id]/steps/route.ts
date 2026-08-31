import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const body = (await request.json()) as { instruction?: string };
  const instruction = body.instruction?.trim();

  if (!instruction) {
    return NextResponse.json({ error: "A preparation instruction is required." }, { status: 400 });
  }

  const { data: lastStep } = await supabaseAdmin
    .from("recipe_steps")
    .select("step_number")
    .eq("recipe_id", id)
    .order("step_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("recipe_steps")
    .insert({
      recipe_id: id,
      step_number: Number(lastStep?.step_number ?? 0) + 1,
      instruction,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Step could not be added: " + error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
