import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type CreateBatchBody = {
  name?: string;
  productionItemIds?: string[];
  requestKey?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BatchRow = {
  id: string;
  name: string;
  status: string;
  requested_count: number;
  created_at: string;
  recipe_intake_jobs: Array<{
    id: string;
    status: string;
    production_item_id: string;
    input_payload: {
      production_item?: { name?: string; kind?: string };
      sources?: unknown[];
    };
  }> | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("recipe_intake_batches")
    .select("id, name, status, requested_count, created_at, recipe_intake_jobs(id, status, production_item_id, input_payload)")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    const forbidden = error.code === "42501";
    return NextResponse.json(
      { error: forbidden ? "Cookbook access is required." : error.message },
      { status: forbidden ? 403 : 500 },
    );
  }

  const batches = ((data ?? []) as BatchRow[]).map((batch) => {
    const counts = (batch.recipe_intake_jobs ?? []).reduce<Record<string, number>>(
      (result, job) => {
        result[job.status] = (result[job.status] ?? 0) + 1;
        return result;
      },
      {},
    );
    return {
      id: batch.id,
      name: batch.name,
      status: batch.status,
      requestedCount: batch.requested_count,
      createdAt: batch.created_at,
      counts,
      jobs: (batch.recipe_intake_jobs ?? []).map((job) => ({
        id: job.id,
        status: job.status,
        productionItemId: job.production_item_id,
        input: job.input_payload,
      })),
    };
  });

  return NextResponse.json({ batches });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: CreateBatchBody;
  try {
    body = (await request.json()) as CreateBatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim();
  const requestKey = body.requestKey?.trim();
  const productionItemIds = Array.from(new Set(body.productionItemIds ?? []));

  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: "Enter a batch name of 120 characters or fewer." },
      { status: 400 },
    );
  }
  if (!requestKey || requestKey.length > 200) {
    return NextResponse.json({ error: "Invalid request key." }, { status: 400 });
  }
  if (
    productionItemIds.length < 1 ||
    productionItemIds.length > 100 ||
    productionItemIds.some((id) => !uuidPattern.test(id))
  ) {
    return NextResponse.json(
      { error: "Choose between 1 and 100 valid production items." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc(
    "create_reconciliation_recipe_batch",
    {
      batch_name: name,
      production_item_ids: productionItemIds,
      request_key: requestKey,
    },
  );

  if (error) {
    const forbidden = error.code === "42501";
    return NextResponse.json(
      { error: forbidden ? "Cookbook editor access is required." : error.message },
      { status: forbidden ? 403 : 400 },
    );
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) {
    return NextResponse.json(
      { error: "Batch creation returned no result." },
      { status: 500 },
    );
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("recipe_intake_jobs")
    .select("id, production_item_id, input_payload")
    .eq("batch_id", result.batch_id)
    .order("created_at", { ascending: true });

  if (jobsError) {
    return NextResponse.json({ error: jobsError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      batchId: result.batch_id,
      jobCount: result.job_count,
      alreadyExisted: result.already_existed,
      jobs: (jobs ?? []).map((job) => ({
        id: job.id,
        productionItemId: job.production_item_id,
        input: job.input_payload,
      })),
    },
    { status: result.already_existed ? 200 : 201 },
  );
}
