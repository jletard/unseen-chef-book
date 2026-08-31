import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const { error } = await supabaseAdmin.from("recipe_items").delete().eq("id", id);

  if (error) return NextResponse.json({ error: "Item could not be removed: " + error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
