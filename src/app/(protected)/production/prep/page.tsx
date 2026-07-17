// src/app/production/prep/page.tsx
//
// Production > Prep
//
// Collaborative weekly prep plan generated from the finalized Production plan.
//
// PURPOSE
//
// This page answers:
//
// "What prep work still needs to happen, what is being worked on, and what is
// already complete?"
//
// Multiple chefs may have this page open at the same time. Task changes should
// be saved immediately and synchronized between connected devices.
//
// IMPORTANT WORKFLOW
//
// 1. Production determines how much of each Menu Item is being cooked.
//
// 2. The application follows the connected Main Dishes, Sides, Components,
//    and Ingredients to calculate a proposed prep list.
//
// 3. The proposed list is reviewed, edited, reordered, and supplemented with
//    manual kitchen tasks.
//
// 4. "Create Final Prep List" saves a snapshot for that production week.
//
// 5. The working page displays the saved prep list rather than continuously
//    recalculating it from live recipe data.
//
// COLLABORATIVE TASK STATES
//
// Every task belongs to one of three working states:
//
// - Not Started
// - In Progress
// - Complete
//
// Moving a task should update the saved record immediately. Other chefs viewing
// the same production week should receive the change in real time.
//
// When a task moves to In Progress, save who started it and when.
//
// When a task moves to Complete, save who completed it and when.
//
// A task can be returned to Not Started or In Progress if it was moved by
// mistake or needs more work.
//
// POSSIBLE TASK EXAMPLES
//
// - Dice 18 lb onions
// - Marinate 14 lb chicken thighs
// - Prepare 3 qt mojo marinade
// - Cook 12 lb brown rice
// - Roast 8 lb carrots
// - Portion 24 cheesecake liners
//
// TASK DETAILS
//
// Tasks should support:
//
// - Quantity
// - Unit
// - Task description
// - Prep category or station
// - Optional production day or run
// - Optional notes
// - Manual tasks
// - Sort order
// - Current status
// - Assigned chef
// - Started by / started at
// - Completed by / completed at
//
// POSSIBLE GROUPS
//
// - Sauces & Components
// - Proteins
// - Vegetables
// - Starches
// - Baking & Desserts
// - Portioning
// - Packaging
// - General Kitchen
//
// REAL-TIME BEHAVIOR
//
// Subscribe to changes for the active prep list through Supabase Realtime.
//
// When another chef changes a task:
//
// - Move it to the correct column.
// - Update the assigned chef and timestamps.
// - Do not require a page refresh.
// - Avoid replacing unsaved text while someone is editing notes.
//
// RETENTION
//
// Keep prep lists for the newest four production weeks. Older lists can be
// pruned because these are temporary operational records.
//
// EXPECTED DATA STRUCTURE
//
// prep_lists
// - id
// - production_week
// - status: draft | final
// - created_at
// - finalized_at
//
// prep_list_items
// - id
// - prep_list_id
// - source_type, nullable for manual tasks
// - source_id, nullable for manual tasks
// - task_name
// - quantity
// - unit
// - prep_category
// - production_day
// - notes
// - status: not_started | in_progress | complete
// - assigned_to
// - started_by
// - started_at
// - completed_by
// - completed_at
// - sort_order
// - is_manual
// - created_at
// - updated_at

export default function PrepPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Prep List</h1>

      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Build and run the collaborative prep plan for a production week. Task
        changes are saved immediately and shared with everyone working from the
        same list.
      </p>

      <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-lg font-semibold">Planned workflow</h2>

        <p className="mt-2 text-sm text-zinc-400">
          Generate a preview from finalized Production, review the calculated
          tasks, add manual work, and create a saved prep list for the selected
          production week.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <section className="rounded-md border border-zinc-800 p-4">
            <h3 className="font-medium">Not Started</h3>

            <p className="mt-1 text-sm text-zinc-500">
              Prep work that still needs someone to take responsibility for it.
            </p>
          </section>

          <section className="rounded-md border border-zinc-800 p-4">
            <h3 className="font-medium">In Progress</h3>

            <p className="mt-1 text-sm text-zinc-500">
              Work currently underway, including who is handling it.
            </p>
          </section>

          <section className="rounded-md border border-zinc-800 p-4">
            <h3 className="font-medium">Complete</h3>

            <p className="mt-1 text-sm text-zinc-500">
              Finished prep work, including who completed it and when.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}