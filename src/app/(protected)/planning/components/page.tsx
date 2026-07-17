// src/app/planning/components/page.tsx
//
// Planning > Components
//
// Master list of reusable recipe components used throughout the Cookbook.
//
// Components are recipes that are prepared as part of another recipe rather
// than served directly to the customer. Examples include sauces, marinades,
// doughs, spice blends, stocks, dressings, batters, fillings, and other
// building blocks used to create finished dishes.
//
// Components may be shared by multiple recipes, allowing a single component
// recipe to be maintained in one place.

export default function ComponentsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Components</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Build and manage reusable recipe components such as sauces,
        marinades, doughs, spice blends, stocks, dressings, pasta dough,
        tortilla dough, and other preparations that become part of finished
        recipes.
      </p>
    </>
  );
}