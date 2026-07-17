// src/app/(protected)/layout.tsx
// Shared authenticated layout for Planning, Production, and Cook.

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/page/AppShell";
import { chooseInitialProductionWeek } from "@/lib/production-weeks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ProductionWeekRow = {
  production_week: string;
};

type Props = {
  children: ReactNode;
};

export default async function ProtectedLayout({ children }: Props) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("production_week")
    .order("production_week", { ascending: false });

  if (error) {
    throw new Error(`Failed to load production weeks: ${error.message}`);
  }

  const rows = (data ?? []) as ProductionWeekRow[];

  const productionWeeks = Array.from(
    new Set(
      rows
        .map((row) => row.production_week)
        .filter(Boolean),
    ),
  );

  const initialProductionWeek =
    chooseInitialProductionWeek(productionWeeks);

  const userName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "John";

  return (
    <AppShell
      userName={userName}
      productionWeeks={productionWeeks}
      initialProductionWeek={initialProductionWeek}
    >
      {children}
    </AppShell>
  );
}