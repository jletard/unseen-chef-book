-- Replace a Major-review parent and create its missing inline components in one transaction.

create or replace function public.import_major_recipe_revision(
  target_draft_id uuid,
  revision_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  parent public.recipe_drafts%rowtype;
  component jsonb;
  component_count integer := 0;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_cookbook_role(array['owner', 'recipe_editor']) then
    raise exception 'Cookbook editor role required' using errcode = '42501';
  end if;

  select * into parent from public.recipe_drafts where id = target_draft_id for update;
  if parent.id is null or parent.draft_state <> 'ready_for_review' then
    raise exception 'Reviewable parent draft not found' using errcode = 'P0002';
  end if;

  for component in select value from jsonb_array_elements(coalesce(revision_payload->'components', '[]'::jsonb))
  loop
    insert into public.recipe_drafts (
      id, draft_state, review_bucket, source_type, source_summary, source_payload,
      draft_payload, validation_errors, generation_metadata, created_by, updated_by
    ) values (
      (component->>'id')::uuid, 'ready_for_review', 'unreviewed', 'secret_ai',
      'Inline component from Major AI+ revision for ' || (revision_payload->'draft'->>'name'),
      parent.source_payload, component->'draft', '[]'::jsonb,
      coalesce(parent.generation_metadata, '{}'::jsonb) || jsonb_build_object(
        'inline_component', true, 'parent_draft_id', parent.id
      ), actor_id, actor_id
    );
    component_count := component_count + 1;
  end loop;

  update public.recipe_drafts
  set draft_payload = revision_payload->'draft', review_bucket = 'major',
      updated_by = actor_id, updated_at = now()
  where id = parent.id;

  insert into public.cookbook_audit_events (actor_id, action, subject_type, subject_id, new_state)
  values (
    actor_id, 'major_recipe_revision_imported', 'recipe_draft', parent.id::text,
    jsonb_build_object('components', component_count)
  );

  return jsonb_build_object('draft_id', parent.id, 'components', component_count);
end;
$$;

revoke all on function public.import_major_recipe_revision(uuid, jsonb) from public;
grant execute on function public.import_major_recipe_revision(uuid, jsonb) to authenticated;
