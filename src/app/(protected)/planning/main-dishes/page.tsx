// src/app/(protected)/planning/main-dishes/page.tsx
//
// Planning > Main Dishes
//
// Master list of every entrée recipe used by The Unseen Chef.
//
// A Main Dish defines how the entrée is prepared. It contains the recipe,
// ingredients, reusable components, cooking instructions, notes, and other
// information required to produce the finished entrée.
//
// Main Dishes do not include side dishes. Default sides are assigned by
// Menu Items, allowing the same entrée to be paired with different sides
// throughout the year.

export default function MainDishesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Main Dishes</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Build and manage the master list of entrée recipes. Main dishes
        contain ingredients, reusable components, cooking instructions, and
        chef notes, while menu items determine which sides are served with
        each entrée.
      </p>
    </>
  );
}