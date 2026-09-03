// src/components/page/AppShell.tsx
// Shared application shell and production-week context.

import type { ReactNode } from "react";
import AppNavigation from "@/components/navigation/AppNavigation";
import PageFooter from "./PageFooter";
import PageHeader from "./PageHeader";
import ProductionWeekProvider from "./ProductionWeekProvider";

type Props = {
  children: ReactNode;
  userName: string;
  productionWeeks: string[];
  initialProductionWeek: string;
};

export default function AppShell({
  children,
  userName,
  productionWeeks,
  initialProductionWeek,
}: Props) {
  return (
    <ProductionWeekProvider
      productionWeeks={productionWeeks}
      initialProductionWeek={initialProductionWeek}
    >
      <div className="flex min-h-screen min-w-0 max-w-full flex-col overflow-x-hidden bg-zinc-950 text-zinc-100">
        <PageHeader userName={userName} />

        <AppNavigation />

        <main className="mx-auto min-w-0 w-full max-w-screen-2xl flex-1 overflow-x-clip p-3 md:p-4">
          {children}
        </main>

        <PageFooter />
      </div>
    </ProductionWeekProvider>
  );
}
