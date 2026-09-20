import { NextRequest, NextResponse } from "next/server";

import {
  getProductionWorkPlan,
  updateProductionWorkTaskStatus,
} from "@/lib/production-work-data";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const productionWeek = request.nextUrl.searchParams.get("production_week");
  if (!productionWeek) {
    return NextResponse.json({ error: "A production week is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getProductionWorkPlan(productionWeek));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load production work." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = (await request.json()) as {
      id?: string;
      status?: "planned" | "in_progress" | "complete";
    };

    if (!body.id || !body.status) {
      return NextResponse.json({ error: "Task id and status are required." }, { status: 400 });
    }

    await updateProductionWorkTaskStatus(body.id, body.status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update production task." },
      { status: 500 },
    );
  }
}
