<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Unseen Chef Cookbook handoff

Before substantial work, read these files in order:

1. `STATUS.md` — current implementation state and active architectural cautions.
2. `TODO.md` — current priorities and unfinished work.
3. `README.md` — application scope and current capabilities.
4. `DESIGN.md` — durable data/UI rules.
5. `supabase/README.md` — database source-of-truth rules.

Important current cautions:

- The live shared Supabase schema is authoritative; historical migrations are intentionally absent.
- The repository contains both older direct recipe helpers (`recipe_items` / `recipe_steps`) and newer cookbook-v2/versioned recipe logic (`recipe_versions` / `recipe_version_items`). Do not assume they are interchangeable. Prefer the approved/versioned path for new derived systems such as labeling and nutrition unless the specific workflow proves otherwise.
- Purchased compound foods need complete supplier/manufacturer ingredient declarations including sub-ingredients. Prepared components should stay recursive recipes rather than copied ingredient text.
- Nutrition is a current goal but is not yet a first-class system. Build it from reusable ingredient facts, unit conversion, approved recipe quantities/yields, and explicit estimated-data handling rather than hard-coded menu calories.
- Preserve information density and production speed. Do not add decorative UI or extra clicks without a kitchen reason.
