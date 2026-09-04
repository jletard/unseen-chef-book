# TODO

This file tracks work that is still meaningfully unfinished. Completed foundation work is documented in `README.md` and `DESIGN.md` rather than kept as a giant historical checklist.

## Working now

- [x] Next.js/React/TypeScript application shell
- [x] Shared Supabase connection
- [x] Authentication
- [x] Dark-mode-only responsive navigation
- [x] Persistent production-week selection
- [x] Menu item, main dish, side, component, ingredient, allergen, category, and protein-type planning views
- [x] Recipe storage, recipe items/components, recipe steps, yields, and recipe editing
- [x] Menu-item-to-recipe relationships
- [x] Reconciliation workflow and review queues
- [x] Data-repair tooling
- [x] Production list
- [x] Shopping list
- [x] Prep list
- [x] Cook / This Week view
- [x] Recipe search
- [x] Avery 6464 retail/grab-and-go label builder
- [x] Ingredient/allergen label data
- [x] Variable/selected side support for labels
- [x] Six-label letter-size printing without trailing blank pages

## Continue improving

- [ ] Continue recipe cleanup and approval until legacy/imported cookbook data is fully reconciled
- [ ] Resolve remaining duplicate, incomplete, or ambiguous culinary records through Reconciliation/Data Repair
- [ ] Keep menu-item-to-recipe relationships complete as menus change
- [ ] Continue validating recipe yields, component relationships, and production scaling against real kitchen use
- [ ] Continue improving shopping/prep/production output where actual production exposes friction
- [ ] Continue validating retail label output and label data against operational/regulatory needs
- [ ] Confirm all general-purpose print views remain compact and do not leak application navigation or controls
- [ ] Improve mobile workflows when actual phone use exposes a problem

## Later, when useful

- [ ] Recipe version-history UI beyond the current approved/draft workflow
- [ ] Ingredient and recipe costing
- [ ] Purchase units and package sizes
- [ ] Vendor purchasing information
- [ ] Nutrition information
- [ ] Inventory
- [ ] Production completion tracking
- [ ] Additional user roles/read-only cook access if multiple users make it necessary
- [ ] Sign Out UI if shared devices or multiple users make it necessary

## Rule

Do not build a feature because an old roadmap says it should exist. Build it when it solves a current kitchen problem.
