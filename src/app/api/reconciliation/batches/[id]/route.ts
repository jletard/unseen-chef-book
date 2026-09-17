import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const activeJobStatuses = new Set(["queued", "processing", "running", "leased"]);

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid batch ID." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("recipe_intake_jobs")
    .select("id, status")
    .eq("batch_id", id);

  if (jobsError) {
    const forbidden = jobsError.code === "42501";
    return NextResponse.json(
      { error: forbidden ? "Cookbook editor access is required." : jobsError.message },
      { status: forbidden ? 403 : 400 },
    );
  }

  if ((jobs ?? []).some((job) => activeJobStatuses.has(String(job.status)))) {
    return NextResponse.json(
      { error: "Finish or stop the active batch before removing it." },
      { status: 409 },
    );
  }

  const { error: deleteJobsError } = await supabase
    .from("recipe_intake_jobs")
    .delete()
    .eq("batch_id", id);

  if (deleteJobsError) {
    const forbidden = deleteJobsError.code === "42501";
    return NextResponse.json(
      { error: forbidden ? "Cookbook editor access is required." : deleteJobsError.message },
      { status: forbidden ? 403 : 400 },
    );
  }

  const { data: deletedBatch, error: deleteBatchError } = await supabase
    .from("recipe_intake_batches")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteBatchError) {
    const forbidden = deleteBatchError.code === "42501";
    return NextResponse.json(
      { error: forbidden ? "Cookbook editor access is required." : deleteBatchError.message },
      { status: forbidden ? 403 : 400 },
    );
  }

  if (!deletedBatch) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  return NextResponse.json({ id, removed: true });
}
