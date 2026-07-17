// src/app/cook/search/page.tsx
//
// Cook > Search
//
// PURPOSE
//
// This page provides access to the entire recipe collection.
//
// Unlike "This Week", these recipes are not tied to a production week.
//
// This is the digital cookbook.
//
// QUESTIONS THIS PAGE ANSWERS
//
// - How do I make Butternut Squash Risotto?
// - What's my Bulgogi marinade recipe?
// - Did I ever make Chicken Marbella?
// - Show me every recipe that uses preserved lemon.
//
// This page should allow searching across:
//
// - Main Dishes
// - Sides
// - Components
//
// SEARCH
//
// Search should be fast and forgiving.
//
// Examples:
//
// butternut
// risotto
// preserved lemon
// bulgogi
// shawarma
// chicken
//
// Future filters may include:
//
// - Category
// - Protein
// - Cuisine
// - Difficulty
// - Season
// - Favorite
// - Recently Cooked
//
// RECIPE VIEW
//
// Opening a recipe displays its normal recipe.
//
// Unlike "This Week", recipes are NOT automatically scaled to production
// quantities.
//
// They should display the recipe's normal yield with optional manual scaling.
//
// Example:
//
// Butternut Squash Risotto
//
// Yield:
// 4 portions
//
// [ Scale: 4 ▼ ]
//
// Future enhancements:
//
// - Photos
// - Chef notes
// - Timers
// - Components
// - Revision history
// - Similar recipes
//
// THIS PAGE IS NOT
//
// - A production report
// - A prep list
// - A shopping list
//
// SEARCH BEHAVIOR
//
// Search should look across:
//
// - Recipe names
// - Ingredient names
// - Component names
// - Categories
// - Protein types
// - Recipe notes
//
// Ingredient searches must include ingredients contained inside Components.
//
// Example:
//
// Searching for "lemongrass" may return:
//
// - Green Curry Chicken
//   Contains lemongrass through Green Curry Paste.
//
// - Lemongrass Skewered Monkfish
//   Contains lemongrass directly.
//
// This allows the cookbook to answer allergen and ingredient questions even
// when the ingredient is not stored directly on the Main Dish.
//
// SEARCH RESULTS
//
// Results should explain why each recipe matched.
//
// Examples:
//
// Bulgogi
// Contains: Sesame Seeds
//
// Green Curry Chicken
// Contains: Lemongrass
// Through component: Green Curry Paste
//
// Recipe results should allow the user to open the complete recipe immediately.
// It is simply the complete cookbook.
//

export default function SearchPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Recipe Search</h1>

      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Search the complete recipe collection. Open any recipe, regardless of
        whether it appears in this week&apos;s production schedule.
      </p>
    </>
  );
}