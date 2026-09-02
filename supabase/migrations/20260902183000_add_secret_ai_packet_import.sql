-- Import a validated Secret AI+ packet as reviewable drafts in one transaction.

create or replace function public.import_secret_ai_recipe_packet(
  intake_batch_id uuid,
  packet_payload jsonb
)
returns table (imported_jobs integer, imported_components integer)
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  entry jsonb;
  component jsonb;
  job public.recipe_intake_jobs%rowtype;
  parent_draft_id uuid;
  job_total integer := 0;
  component_total integer := 0;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_cookbook_role(array['owner', 'recipe_editor']) then
    raise exception 'Cookbook editor role required' using errcode = '42501';
  end if;
  if jsonb_typeof(packet_payload) <> 'array' or jsonb_array_length(packet_payload) < 1 then
    raise exception 'Packet must contain at least one recipe' using errcode = '22023';
  end if;

  for entry in select value from jsonb_array_elements(packet_payload)
  loop
    select * into job
    from public.recipe_intake_jobs
    where id = (entry->>'jobId')::uuid
      and batch_id = intake_batch_id
    for update;

    if job.id is null then
      raise exception 'Packet contains a job outside this batch' using errcode = '22023';
    end if;
    if job.status not in ('queued', 'failed', 'needs_input') then
      raise exception 'Job % has already been imported', job.id using errcode = '55000';
    end if;
    if job.production_item_id is distinct from (entry->>'productionItemId')::uuid then
      raise exception 'Production item does not match job %', job.id using errcode = '22023';
    end if;

    for component in select value from jsonb_array_elements(coalesce(entry->'components', '[]'::jsonb))
    loop
      insert into public.recipe_drafts (
        id, draft_state, review_bucket, source_type, source_summary, source_payload,
        draft_payload, validation_errors, generation_metadata, created_by, updated_by
      ) values (
        (component->>'id')::uuid,
        'ready_for_review', 'unreviewed', 'secret_ai',
        'Inline component from Secret AI+ packet for ' || (entry->'draft'->>'name'),
        job.input_payload, component->'draft', '[]'::jsonb,
        jsonb_build_object('batch_id', intake_batch_id, 'job_id', job.id, 'inline_component', true),
        actor_id, actor_id
      );
      component_total := component_total + 1;
    end loop;

    insert into public.recipe_drafts (
      draft_state, review_bucket, source_type, source_summary, source_payload,
      draft_payload, validation_errors, generation_metadata, created_by, updated_by
    ) values (
      'ready_for_review', 'unreviewed', 'secret_ai',
      'Secret AI+ packet import for ' || (entry->'draft'->>'name'),
      job.input_payload, entry->'draft', '[]'::jsonb,
      jsonb_build_object('batch_id', intake_batch_id, 'job_id', job.id),
      actor_id, actor_id
    ) returning id into parent_draft_id;

    update public.recipe_intake_jobs
    set status = 'ready', draft_id = parent_draft_id,
        provider_metadata = jsonb_build_object('method', 'secret_ai_clipboard'),
        last_error = null, lease_owner = null, lease_expires_at = null, updated_at = now()
    where id = job.id;
    job_total := job_total + 1;
  end loop;

  update public.recipe_intake_batches b
  set status = case
      when exists (select 1 from public.recipe_intake_jobs j where j.batch_id = b.id and j.status in ('queued', 'generating', 'matching')) then 'running'
      when exists (select 1 from public.recipe_intake_jobs j where j.batch_id = b.id and j.status in ('failed', 'needs_input')) then 'partially_failed'
      else 'ready'
    end,
    updated_at = now()
  where b.id = intake_batch_id;

  insert into public.cookbook_audit_events (
    actor_id, action, subject_type, subject_id, new_state
  ) values (
    actor_id, 'secret_ai_packet_imported', 'recipe_intake_batch', intake_batch_id::text,
    jsonb_build_object('jobs', job_total, 'components', component_total)
  );

  return query select job_total, component_total;
end;
$$;

revoke all on function public.import_secret_ai_recipe_packet(uuid, jsonb) from public;
grant execute on function public.import_secret_ai_recipe_packet(uuid, jsonb) to authenticated;
