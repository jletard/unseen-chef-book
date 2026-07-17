// src/app/(protected)/production/shopping/page.tsx
//
// Production > Shopping
//
// Weekly purchasing lists generated from the Production plan.
//
// IMPORTANT WORKFLOW
//
// 1. Production determines the total quantities being cooked for a production
//    week.
//
// 2. The application uses the recipes connected to those Menu Items, Main
//    Dishes, Sides, and Components to calculate a proposed shopping list.
//
// 3. The calculated list is presented as a preview. It can be reviewed,
//    adjusted, and supplemented with manual items.
//
// 4. "Create Final List" saves a permanent snapshot for that production week.
//
// 5. After finalization, this page displays the saved list from the shopping
//    list tables. It does not continually recalculate the displayed list from
//    live recipe data.
//
// This snapshot approach is intentional:
//
// - Recipe edits must not change a shopping list after shopping has started.
// - Multiple production weeks can have shopping lists at the same time.
// - The current list, next week's list, and a few recent lists can be opened
//   without overwriting one another.
// - Checkbox progress belongs to the saved list and survives page refreshes
//   and switching between devices.
//
// FINAL LIST BEHAVIOR
//
// Saved items are divided into:
//
// - Still Needed
// - Shopped
//
// Checking an item moves it from Still Needed to Shopped.
// Unchecking it moves it back to Still Needed.
//
// Shopping progress should be saved immediately so this page can function as
// the working shopping list on a phone. It should also provide a clean print
// view for paper and Sharpie use.
//
// RETENTION
//
// Keep shopping lists for the newest four production weeks. Lists older than
// that can be pruned. Shopping lists are temporary operational records, not
// permanent cookbook or accounting history.
//
// EXPECTED DATA STRUCTURE
//
// shopping_lists
// - id
// - production_week
// - status: draft | final
// - created_at
// - finalized_at
//
// shopping_list_items
// - id
// - shopping_list_id
// - ingredient_id, nullable for manual items
// - item_name
// - quantity
// - unit
// - shopping_category
// - is_shopped
// - shopped_at
// - sort_order
// - is_manual
// - created_at
// - updated_at

export default function ShoppingPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Shopping</h1>

      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Build and save the purchasing list for a production week. Finalized
        lists remain available while you shop, with purchased items moving from
        Still Needed to Shopped.
      </p>

      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-semibold">Planned workflow</h2>

        <p className="mt-2 text-sm text-zinc-400">
          Generate a preview from Production and its connected recipes, review
          the calculated ingredients, add any manual purchases, and create a
          final saved list for the selected production week.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-md border border-zinc-800 p-4">
            <h3 className="font-medium">Still Needed</h3>

            <p className="mt-1 text-sm text-zinc-500">
              Unshopped items remain here so the outstanding purchases are
              always easy to scan.
            </p>
          </section>

          <section className="rounded-md border border-zinc-800 p-4">
            <h3 className="font-medium">Shopped</h3>

            <p className="mt-1 text-sm text-zinc-500">
              Checked items move here and remain saved with this production
              week&apos;s final shopping list.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}