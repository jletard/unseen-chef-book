// src/app/planning/sides/page.tsx
//
// Planning > Sides
//
// Master list of every side dish available to The Unseen Chef.
//
// Sides are served alongside menu items and are categorized as vegetables
// or starches. Each side contains its own recipe, ingredients,
// instructions, and production information.
//
// Sides may range from simple preparations, such as roasted broccoli, to
// complex recipes like macaroni and cheese. They are managed separately
// from menu items and reusable recipe components so they can be assigned
// as default sides throughout the Cookbook.

export default function SidesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Sides</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Create and manage the master list of side dishes used throughout the
        Cookbook. Assign sides to menu items, maintain recipes, and organize
        vegetable and starch preparations in one place.
      </p>
    </>
  );
}