// src/app/(protected)/production/page.tsx
//
// Production
//
// Weekly production summary generated from confirmed customer orders.
//
// Production is the master cooking plan for the week. It consolidates
// identical menu items into total production quantities and serves as the
// source for Shopping and Prep.
//
// This view focuses on what needs to be cooked, not who ordered it.
// Customer-specific details remain available in packing and order reports.

export default function ProductionPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Production</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Review the total production required for the current week. This is
        the master cooking list used to generate Shopping and Prep, showing
        only total quantities required for each menu item.
      </p>
    </>
  );
}