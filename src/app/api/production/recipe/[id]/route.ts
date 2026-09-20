import { NextRequest, NextResponse } from "next/server";

import { getApprovedRecipeEditorData } from "@/lib/recipe-data";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const recipe = await getApprovedRecipeEditorData(id);

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    }

    return NextResponse.json({
      recipeId: recipe.recipeId,
      name: recipe.name,
      baseYield: recipe.baseYield,
      yieldUnit: recipe.yieldUnit,
      portionQuantity: recipe.portionQuantity,
      portionUnit: recipe.portionUnit,
      chefNotes: recipe.chefNotes,
      items: recipe.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        preparationNote: item.preparationNote,
      })),
      steps: recipe.steps,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load recipe.",
      },
      { status: 500 },
    );
  }
}
