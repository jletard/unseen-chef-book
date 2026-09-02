-- Finalization is an owner-only, server-like transaction that must write both
-- legacy catalog rows and the protected immutable recipe snapshot tables.
-- The function performs its own authenticated owner check before any writes.

alter function public.finalize_ready_recipe_draft(uuid) security definer;
alter function public.finalize_ready_recipe_draft(uuid) set search_path = '';

revoke all on function public.finalize_ready_recipe_draft(uuid) from public;
grant execute on function public.finalize_ready_recipe_draft(uuid) to authenticated;
