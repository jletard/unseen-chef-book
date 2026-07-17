// src/lib/production-weeks.ts
// Helpers for selecting the current Sunday production week.

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getCurrentProductionWeek(): string {
  const today = new Date();
  const daysUntilSunday = (7 - today.getDay()) % 7;

  const sunday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + daysUntilSunday,
  );

  return formatDateOnly(sunday);
}

export function chooseInitialProductionWeek(
  productionWeeks: string[],
): string {
  const currentProductionWeek = getCurrentProductionWeek();

  if (productionWeeks.includes(currentProductionWeek)) {
    return currentProductionWeek;
  }

  const futureWeeks = productionWeeks
    .filter((week) => week > currentProductionWeek)
    .sort();

  if (futureWeeks.length > 0) {
    return futureWeeks[0];
  }

  return productionWeeks[0] ?? currentProductionWeek;
}