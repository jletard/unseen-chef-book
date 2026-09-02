-- Finalize a dependency-ordered group in one database transaction. If any
-- recipe fails, none in this call are committed, and the error names the draft.

create or replace function public.finalize_ready_recipe_drafts(ready_draft_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  draft_id_value uuid;
  draft_name text;
  finalized jsonb := '[]'::jsonb;
  finalized_item jsonb;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_cookbook_role(array['owner']) then
    raise exception 'Cookbook owner role required' using errcode = '42501';
  end if;

  foreach draft_id_value in array coalesce(ready_draft_ids, array[]::uuid[])
  loop
    select draft_payload->>'name' into draft_name
    from public.recipe_drafts
    where id = draft_id_value;

    begin
      finalized_item := public.finalize_ready_recipe_draft(draft_id_value);
      finalized := finalized || jsonb_build_array(finalized_item);
    exception when others then
      raise exception 'Finalization failed for "%": %',
        coalesce(draft_name, draft_id_value::text), sqlerrm;
    end;
  end loop;

  return finalized;
end;
$$;

revoke all on function public.finalize_ready_recipe_drafts(uuid[]) from public;
grant execute on function public.finalize_ready_recipe_drafts(uuid[]) to authenticated;
