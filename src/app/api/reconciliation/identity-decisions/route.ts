import { NextResponse } from "next/server";

import { normalizeCookbookName } from "@/lib/cookbook-v2/normalize-name";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function isIdentityTask(taskType: string) {
  return taskType === "source_mapping" || taskType.endsWith("_match");
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const [{ data: tasks, error: taskError }, { data: productionItems, error: itemError }] = await Promise.all([
    supabaseAdmin
      .from("reconciliation_tasks")
      .select("id, task_type, subject_type, subject_id, status, priority, candidate_payload")
      .in("status", ["open", "deferred"])
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("production_items")
      .select("id, name, kind, active")
      .is("retired_at", null)
      .order("name", { ascending: true }),
  ]);

  const error = taskError ?? itemError;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    tasks: (tasks ?? []).filter((task) => isIdentityTask(task.task_type)),
    productionItems: productionItems ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json() as {
      taskId?: string;
      action?: "map" | "create";
      productionItemId?: string;
    };
    if (!body.taskId || !body.action) {
      return NextResponse.json({ error: "Choose an identity decision and action." }, { status: 400 });
    }

    const { data: task, error: taskError } = await supabaseAdmin
      .from("reconciliation_tasks")
      .select("id, task_type, subject_type, subject_id, status, candidate_payload")
      .eq("id", body.taskId)
      .in("status", ["open", "deferred"])
      .single();
    if (taskError || !task) throw new Error(taskError?.message ?? "Identity decision was not found.");
    if (!isIdentityTask(task.task_type)) throw new Error("This task is not an identity decision.");
    if (task.task_type !== "source_mapping") {
      throw new Error(`Direct resolution for ${task.task_type.replaceAll("_", " ")} is not supported here yet.`);
    }

    const candidate = (task.candidate_payload ?? {}) as Record<string, unknown>;
    const sourceName = String(candidate.source_name ?? task.subject_id).trim();
    const normalizedName = String(candidate.normalized_name ?? normalizeCookbookName(sourceName));
    let productionItemId = body.productionItemId ?? "";
    let productionItemName = "";

    if (body.action === "map") {
      if (!productionItemId) throw new Error("Choose the existing production item this source belongs to.");
      const { data: item, error } = await supabaseAdmin
        .from("production_items")
        .select("id, name")
        .eq("id", productionItemId)
        .is("retired_at", null)
        .single();
      if (error || !item) throw new Error(error?.message ?? "Production item was not found.");
      productionItemName = item.name;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("production_items")
        .insert({
          name: sourceName,
          normalized_name: normalizedName,
          kind: task.subject_type === "embedded_side" ? "side" : "other",
          active: true,
          recipe_requirement: "required",
        })
        .select("id, name")
        .single();
      if (error || !created) throw new Error(error?.message ?? "Production item could not be created.");
      productionItemId = created.id;
      productionItemName = created.name;

      const { error: queueError } = await supabaseAdmin
        .from("reconciliation_tasks")
        .insert({
          task_type: "missing_recipe",
          subject_type: "production_item",
          subject_id: productionItemId,
          priority: 20,
          candidate_payload: {
            production_item_id: productionItemId,
            name: productionItemName,
            kind: task.subject_type === "embedded_side" ? "side" : "other",
            active: true,
          },
        });
      if (queueError && queueError.code !== "23505") throw new Error(queueError.message);
    }

    const now = new Date().toISOString();
    const { error: sourceError } = await supabaseAdmin
      .from("production_item_sources")
      .insert({
        production_item_id: productionItemId,
        source_type: task.subject_type,
        source_id: task.subject_id,
        source_name_snapshot: sourceName,
        normalized_source_name: normalizedName,
        mapping_state: "confirmed",
        confirmed_by: user.id,
        confirmed_at: now,
      });
    if (sourceError && sourceError.code !== "23505") throw new Error(sourceError.message);

    const { error: resolveError } = await supabaseAdmin
      .from("reconciliation_tasks")
      .update({
        status: "resolved",
        resolution_payload: {
          action: body.action,
          production_item_id: productionItemId,
          production_item_name: productionItemName,
        },
        resolved_by: user.id,
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", task.id);
    if (resolveError) throw new Error(resolveError.message);

    return NextResponse.json({
      taskId: task.id,
      productionItemId,
      productionItemName,
      action: body.action,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Identity decision could not be resolved." },
      { status: 400 },
    );
  }
}
