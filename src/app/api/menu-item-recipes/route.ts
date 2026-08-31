import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const roles = new Set(["main", "component", "garnish"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    menuItemId?: string;
    recipeId?: string;
    role?: string;
  };

  if (
    !body.menuItemId ||
    !body.recipeId ||
    !body.role ||
    !roles.has(body.role)
  ) {
    return NextResponse.json(
      { error: "Menu item, recipe, and role are required." },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("menu_item_recipe_links")
    .insert({
      menu_item_id: body.menuItemId,
      recipe_id: body.recipeId,
      role: body.role,
    })
    .select("id, menu_item_id, recipe_id, role, sort_order")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Recipe could not be attached: " + error.message },
      { status: error.code === "23505" ? 409 : 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
