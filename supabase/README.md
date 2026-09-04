# Supabase

The Unseen Chef Cookbook uses the existing shared production Supabase project.

The historical one-time SQL migration and verification files that originally built the Cookbook database changes have been removed from this repository after they were applied. Deleting those files from Git does not remove or roll back database objects already present in Supabase.

## Source of truth

For the current application, the live Supabase schema and behavior are authoritative. Application code should use the existing database objects rather than assuming this repository can recreate the database from a local migration history.

Do not invent, recreate, or rerun historical migrations merely because the old SQL files are absent.

## Future database changes

If a future feature genuinely requires a database change:

1. Inspect the current live schema and existing application usage first.
2. Make the smallest additive/safe change required for the feature.
3. Treat production data as persistent and valuable; do not destructively replace working structures without an explicit migration plan.
4. Update the application documentation to describe the resulting current state.

The goal of this repository is the working Cookbook application, not preservation of one-time SQL for its own sake.
