// src/components/page/ProductionWeekSelect.tsx
// Header selector for the application-wide production week.

"use client";

import { useProductionWeek } from "./ProductionWeekProvider";

function formatProductionWeek(value: string): string {
  const date = new Date(`${value}T12:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ProductionWeekSelect() {
  const {
    productionWeek,
    setProductionWeek,
    productionWeeks,
  } = useProductionWeek();

  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-xs text-zinc-500 sm:inline">
        Week
      </span>

      <select
        aria-label="Production week"
        value={productionWeek}
        onChange={(event) => {
          setProductionWeek(event.target.value);
        }}
        className="h-8 max-w-48 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 outline-none hover:border-zinc-600 focus:border-zinc-500"
      >
        {productionWeeks.map((week) => (
          <option key={week} value={week}>
            {formatProductionWeek(week)}
          </option>
        ))}
      </select>
    </label>
  );
}