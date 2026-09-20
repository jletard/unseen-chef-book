import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type ProductionWorkTask = {
  id: string;
  productionWeek: string;
  workDate: string;
  taskKey: string;
  category: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  status: "planned" | "in_progress" | "complete";
  sourceType: "manual" | "generated";
  notes: string | null;
  sortOrder: number;
};

export async function getProductionWorkPlan(productionWeek: string): Promise<ProductionWorkTask[]> {
  const { data, error } = await supabaseAdmin
    .from("production_work_tasks")
    .select("id, production_week, work_date, task_key, category, label, quantity, unit, status, source_type, notes, sort_order")
    .eq("production_week", productionWeek)
    .order("work_date", { ascending: true })
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw new Error("Failed to load production work plan: " + error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    productionWeek: String(row.production_week),
    workDate: String(row.work_date),
    taskKey: String(row.task_key),
    category: String(row.category),
    label: String(row.label),
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit ? String(row.unit) : null,
    status:
      row.status === "complete"
        ? "complete"
        : row.status === "in_progress"
          ? "in_progress"
          : "planned",
    sourceType: row.source_type === "generated" ? "generated" : "manual",
    notes: row.notes ? String(row.notes) : null,
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

export async function updateProductionWorkTaskStatus(
  id: string,
  status: "planned" | "in_progress" | "complete",
) {
  const { data, error } = await supabaseAdmin
    .from("production_work_tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();

  if (error) throw new Error("Failed to update production task: " + error.message);
  return data;
}
