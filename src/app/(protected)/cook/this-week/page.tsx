// src/app/cook/this-week/page.tsx
//
// Cook > This Week
//
// PURPOSE
//
// This page acts as the kitchen recipe binder for the selected production week.
//
// Unlike the Production pages, this page is focused on cooking rather than
// planning or task management.
//
// QUESTIONS THIS PAGE ANSWERS
//
// - What recipes do I need to make this week?
// - How many portions of each recipe are required?
// - How do I make it?
//
// WORKFLOW
//
// Production determines:
//
// - Which Menu Items have been ordered.
// - How many portions are required.
//
// The application expands those orders into:
//
// - Main Dishes
// - Sides
// - Components
//
// This page simply presents those recipes in a format that is easy to cook
// from.
//
// The user should be able to tap any recipe to immediately display the
// scaled recipe.
//
// AUTO SCALING
//
// Recipes displayed here should automatically scale to the quantities required
// for the selected production week.
//
// Example:
//
// Production:
//
//   Chicken Shawarma ........ 17 portions
//
// Opening the recipe should automatically display:
//
//   Chicken Thighs ....... 6 lb 6 oz
//   Marinade ............. 3 qt
//   Garlic ............... 2 heads
//
// The cook should never need to manually multiply recipe quantities.
//
// THIS IS NOT
//
// - A prep checklist
// - A shopping list
// - A production report
//
// Those belong under Production.
//
// This page is simply the digital recipe binder for the current week.
//
// POSSIBLE LAYOUT
//
// ------------------------------------------------
//
// This Week
//
// 17 Chicken Shawarma
// 12 Miso Glazed Salmon
// 11 Veracruz Shrimp
// 18 Cilantro Lime Rice
// 18 Roasted Carrots
//
// ------------------------------------------------
//
// Selecting an item displays the scaled recipe.
//
// Future enhancements may include:
//
// - Ingredients
// - Method
// - Photos
// - Timers
// - Chef notes
// - Components
// - Scaling controls
// - Next / Previous recipe navigation
//

export default function ThisWeekPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">This Week</h1>

      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Browse every recipe needed for the selected production week. Recipes
        will automatically scale to the required production quantities and can
        be opened as a digital kitchen recipe binder.
      </p>
    </>
  );
}