-- Atomic, role-checked reconciliation batch creation.

alter table public.recipe_intake_batches
  add column if not exists idempotency_key text;

create unique index if not exists recipe_intake_batches_idempotency_key_uidx
  on public.recipe_intake_batches (idempotency_key)
  where idempotency_key is not null;

create or replace function public.create_reconciliation_recipe_batch(
  batch_name text,
  production_item_ids uuid[],
  request_key text
)
returns table (batch_id uuid, job_count integer, already_existed boolean)
language plpgsql
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_name text := nullif(trim(batch_name), '');
  normalized_request_key text := nullif(trim(request_key), '');
  selected_count integer;
  valid_count integer;
  created_batch_id uuid;
  existing_batch_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_cookbook_role(array['owner', 'recipe_editor']) then
    raise exception 'Cookbook editor role required' using errcode = '42501';
  end if;

  if normalized_name is null then
    raise exception 'Batch name is required' using errcode = '22023';
  end if;

  if normalized_request_key is null then
    raise exception 'Request key is required' using errcode = '22023';
  end if;

  select b.id into existing_batch_id
  from public.recipe_intake_batches b
  where b.idempotency_key = normalized_request_key;

  if existing_batch_id is not null then
    return query
    select
      existing_batch_id,
      count(*)::integer,
      true
    from public.recipe_intake_jobs j
    where j.batch_id = existing_batch_id;
    return;
  end if;

  select count(*) into selected_count
  from (select distinct unnest(production_item_ids)) selected;

  if selected_count < 1 or selected_count > 100 then
    raise exception 'Choose between 1 and 100 production items' using errcode = '22023';
  end if;

  select count(*) into valid_count
  from (
    select distinct unnest(production_item_ids) as id
  ) selected
  join public.production_items p on p.id = selected.id
  join public.reconciliation_tasks t
    on t.task_type = 'missing_recipe'
   and t.subject_type = 'production_item'
   and t.subject_id = p.id::text
   and t.status in ('open', 'deferred');

  if valid_count <> selected_count then
    raise exception 'Selection contains an item that no longer needs a recipe'
      using errcode = '22023';
  end if;

  insert into public.recipe_intake_batches (
    name,
    source_type,
    requested_count,
    status,
    idempotency_key,
    created_by
  )
  values (
    normalized_name,
    'reconciliation',
    selected_count,
    'queued',
    normalized_request_key,
    actor_id
  )
  returning id into created_batch_id;

  insert into public.recipe_intake_jobs (
    batch_id,
    production_item_id,
    idempotency_key,
    status,
    input_payload
  )
  select
    created_batch_id,
    p.id,
    encode(
      extensions.digest(
        convert_to(normalized_request_key || ':' || p.id::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    ),
    'queued',
    jsonb_build_object(
      'production_item', jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'kind', p.kind,
        'active', p.active,
        'recipe_requirement', p.recipe_requirement
      ),
      'sources', coalesce((
        select jsonb_agg(jsonb_build_object(
          'source_type', s.source_type,
          'source_id', s.source_id,
          'name', s.source_name_snapshot,
          'mapping_state', s.mapping_state
        ) order by s.source_type, s.source_name_snapshot)
        from public.production_item_sources s
        where s.production_item_id = p.id
      ), '[]'::jsonb)
    )
  from public.production_items p
  join (
    select distinct unnest(production_item_ids) as id
  ) selected on selected.id = p.id
  order by p.name;

  insert into public.cookbook_audit_events (
    actor_id,
    action,
    subject_type,
    subject_id,
    request_id,
    new_state
  )
  values (
    actor_id,
    'recipe_intake_batch_created',
    'recipe_intake_batch',
    created_batch_id::text,
    normalized_request_key,
    jsonb_build_object('name', normalized_name, 'job_count', selected_count)
  );

  return query select created_batch_id, selected_count, false;
end;
$$;

revoke all on function public.create_reconciliation_recipe_batch(text, uuid[], text) from public;
grant execute on function public.create_reconciliation_recipe_batch(text, uuid[], text) to authenticated;

create or replace function public.claim_recipe_intake_jobs(
  worker_id text,
  claim_limit integer default 5,
  lease_seconds integer default 300
)
returns setof public.recipe_intake_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(worker_id), '') is null then
    raise exception 'Worker ID is required' using errcode = '22023';
  end if;
  if claim_limit < 1 or claim_limit > 20 then
    raise exception 'Claim limit must be between 1 and 20' using errcode = '22023';
  end if;
  if lease_seconds < 30 or lease_seconds > 1800 then
    raise exception 'Lease must be between 30 and 1800 seconds' using errcode = '22023';
  end if;

  return query
  with claimable as (
    select j.id
    from public.recipe_intake_jobs j
    where (
      j.status = 'queued'
      or (j.status = 'generating' and j.lease_expires_at < now())
    )
    order by j.created_at, j.id
    for update skip locked
    limit claim_limit
  )
  update public.recipe_intake_jobs j
  set
    status = 'generating',
    attempt_count = j.attempt_count + 1,
    lease_owner = trim(worker_id),
    lease_expires_at = now() + make_interval(secs => lease_seconds),
    updated_at = now()
  from claimable c
  where j.id = c.id
  returning j.*;
end;
$$;

revoke all on function public.claim_recipe_intake_jobs(text, integer, integer) from public;
grant execute on function public.claim_recipe_intake_jobs(text, integer, integer) to service_role;

create or replace function public.complete_recipe_intake_job(
  intake_job_id uuid,
  worker_id text,
  generated_payload jsonb,
  generation_details jsonb default '{}'::jsonb,
  payload_errors jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.recipe_intake_jobs%rowtype;
  created_draft_id uuid;
  has_errors boolean;
begin
  select * into job
  from public.recipe_intake_jobs
  where id = intake_job_id
  for update;

  if job.id is null then
    raise exception 'Intake job was not found' using errcode = 'P0002';
  end if;
  if job.status <> 'generating' or job.lease_owner is distinct from trim(worker_id) then
    raise exception 'Worker does not own this job lease' using errcode = '42501';
  end if;
  if job.lease_expires_at < now() then
    raise exception 'Job lease expired' using errcode = '55000';
  end if;
  if jsonb_typeof(generated_payload) <> 'object' then
    raise exception 'Generated draft payload must be an object' using errcode = '22023';
  end if;
  if jsonb_typeof(payload_errors) <> 'array' then
    raise exception 'Payload errors must be an array' using errcode = '22023';
  end if;

  has_errors := jsonb_array_length(payload_errors) > 0;

  insert into public.recipe_drafts (
    draft_state,
    review_bucket,
    source_type,
    source_summary,
    source_payload,
    draft_payload,
    validation_errors,
    generation_metadata,
    revision_number
  )
  values (
    case when has_errors then 'blocked' else 'ready_for_review' end,
    case when has_errors then 'needs_classification' else 'unreviewed' end,
    'generated',
    'Generated from production reconciliation intake job ' || job.id::text,
    job.input_payload,
    generated_payload,
    payload_errors,
    coalesce(generation_details, '{}'::jsonb),
    1
  )
  returning id into created_draft_id;

  update public.recipe_intake_jobs
  set
    status = case when has_errors then 'needs_input' else 'ready' end,
    draft_id = created_draft_id,
    provider_metadata = coalesce(generation_details, '{}'::jsonb),
    last_error = null,
    lease_owner = null,
    lease_expires_at = null,
    updated_at = now()
  where id = job.id;

  update public.recipe_intake_batches b
  set
    status = case
      when exists (
        select 1 from public.recipe_intake_jobs j
        where j.batch_id = b.id and j.status in ('queued', 'generating', 'matching')
      ) then 'running'
      when exists (
        select 1 from public.recipe_intake_jobs j
        where j.batch_id = b.id and j.status in ('failed', 'needs_input')
      ) then 'partially_failed'
      else 'ready'
    end,
    updated_at = now()
  where b.id = job.batch_id;

  return created_draft_id;
end;
$$;

revoke all on function public.complete_recipe_intake_job(uuid, text, jsonb, jsonb, jsonb) from public;
grant execute on function public.complete_recipe_intake_job(uuid, text, jsonb, jsonb, jsonb) to service_role;

create or replace function public.fail_recipe_intake_job(
  intake_job_id uuid,
  worker_id text,
  error_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.recipe_intake_jobs%rowtype;
begin
  select * into job
  from public.recipe_intake_jobs
  where id = intake_job_id
  for update;

  if job.id is null then
    raise exception 'Intake job was not found' using errcode = 'P0002';
  end if;
  if job.status <> 'generating' or job.lease_owner is distinct from trim(worker_id) then
    raise exception 'Worker does not own this job lease' using errcode = '42501';
  end if;

  update public.recipe_intake_jobs
  set
    status = 'failed',
    last_error = left(coalesce(nullif(trim(error_message), ''), 'Unknown generation failure'), 4000),
    lease_owner = null,
    lease_expires_at = null,
    updated_at = now()
  where id = job.id;

  update public.recipe_intake_batches
  set status = 'partially_failed', updated_at = now()
  where id = job.batch_id;
end;
$$;

revoke all on function public.fail_recipe_intake_job(uuid, text, text) from public;
grant execute on function public.fail_recipe_intake_job(uuid, text, text) to service_role;
