# Cookbook database changes

These migrations implement the approved additive Cookbook architecture. They
do not replace or delete the legacy tables.

## Safety order

1. Export the affected production tables and schema.
2. Restore the export into a non-production Supabase project.
3. Apply migrations in filename order.
4. Run `verification/verify_cookbook_foundation.sql`.
5. Require `passed: true`, an empty `failures` array, no broken dependencies,
   and no source collisions.
6. Inspect the reconciliation counts and confirm the two known unmatched
   embedded sides remain explicit: `Basmati Rice` and
   `Garlic Roasted Broccoli`.
7. Assign the initial owner role using the authenticated user's UUID in the
   Supabase dashboard. Do not identify the owner by display name.
8. Keep `COOKBOOK_V2_RECONCILIATION_ENABLED=false` until the same sequence has
   succeeded against the intended target and the initial owner can read it.

## Initial owner bootstrap

Run this once through an administrative database session, replacing the UUID
with the verified `auth.users.id`:

```sql
insert into public.cookbook_user_roles (user_id, role)
values ('00000000-0000-0000-0000-000000000000', 'owner')
on conflict (user_id, role) do nothing;
```

The placeholder UUID is intentionally unusable as an owner identity. Never
guess this value and never select a user based only on a name.

## Migration contents

- `20260902171000_add_cookbook_foundation.sql` adds roles, immutable approved
  versions, aggregate drafts, identity decisions, production identities,
  intake jobs, reconciliation tasks, audit events, and RLS policies.
- `20260902172000_backfill_cookbook_foundation.sql` deterministically snapshots
  every complete recipe, preserves legacy drafts, maps stable menu/side/bulk
  catalog IDs, preserves current recipe links, and creates the complete missing
  recipe queue.

Both migrations are designed to preserve existing IDs and legacy rows. The
backfill uses deterministic derived UUIDs so a rehearsal can be compared
exactly and guarded inserts do not create duplicate migrated records.
