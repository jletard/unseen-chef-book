import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json() as { ids?: string[] };
    const ids = Array.from(new Set(body.ids ?? []));

    if (ids.length === 0 || ids.length > 500 || ids.some((id) => !uuidPattern.test(id))) {
      return NextResponse.json({ error: "Submit between 1 and 500 valid ingredient IDs." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("ingredients")
      .update({
        label_review_status: "confirmed",
        label_reviewed_at: new Date().toISOString(),
      })
      .in("id", ids)
      .select("id");

    if (error) throw error;

    return NextResponse.json({ savedCount: data?.length ?? 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk review confirmation failed." },
      { status: 500 },
    );
  }
}
