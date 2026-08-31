import { NextRequest, NextResponse } from "next/server";

import { getProductionSummary } from "@/lib/cookbook-data";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const productionWeek = request.nextUrl.searchParams.get("production_week");

  if (!productionWeek) {
    return NextResponse.json(
      { error: "A production week is required." },
      { status: 400 },
    );
  }

  try {
    const summary = await getProductionSummary(productionWeek);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load production.",
      },
      { status: 500 },
    );
  }
}
