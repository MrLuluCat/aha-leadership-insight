-- AHA Leadership Insight - Cross-database Full Backup Restore & Admin Cleanup RPCs
-- Run after 0001_schema.sql and 0002_functions.sql in Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- Admin: delete a single assessment result (and its session/responses)
-- ---------------------------------------------------------------------------

create or replace function public.admin_delete_result(p_result_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  select assessment_session_id into v_session_id
  from public.assessment_results
  where id = p_result_id;

  if not found then
    return false;
  end if;

  delete from public.assessment_results where id = p_result_id;
  delete from public.assessment_sessions where id = v_session_id;
  return true;
end;
$$;

revoke all on function public.admin_delete_result(uuid) from public, anon;
grant execute on function public.admin_delete_result(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: cross-database full backup restore (safe, non-destructive, idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.admin_restore_full_backup(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dims jsonb := case when jsonb_typeof(p_payload -> 'dimensions') = 'array' then p_payload -> 'dimensions' else '[]'::jsonb end;
  v_questions jsonb := case when jsonb_typeof(p_payload -> 'questions') = 'array' then p_payload -> 'questions' else '[]'::jsonb end;
  v_versions jsonb := case when jsonb_typeof(p_payload -> 'versions') = 'array' then p_payload -> 'versions' else '[]'::jsonb end;
  v_results jsonb := case when jsonb_typeof(p_payload -> 'participant_results') = 'array' then p_payload -> 'participant_results' else '[]'::jsonb end;

  v_dim jsonb;
  v_q jsonb;
  v_ver jsonb;
  v_res jsonb;
  v_resp jsonb;

  v_dim_map jsonb := '{}'::jsonb;
  v_q_map jsonb := '{}'::jsonb;
  v_ver_map jsonb := '{}'::jsonb;

  v_old_id text;
  v_target_dim_id uuid;
  v_target_q_id uuid;
  v_target_ver_id uuid;
  v_fallback_ver_id uuid;
  v_participant_id uuid;
  v_session_id uuid;
  v_existing_res_id uuid;

  v_name text;
  v_email text;
  v_q_text text;
  v_completed_at timestamptz;
  v_published_at timestamptz;
  v_created_at timestamptz;
  v_ver_num integer;
  v_sort_order integer;
  v_weight numeric;
  v_overall_score numeric;
  v_ans integer;
  v_corr integer;
  v_dim_scores jsonb;
  v_enriched_dims jsonb;
  v_ds jsonb;
  v_ds_dim record;
  v_snapshot jsonb;
  v_q_snap jsonb;
  v_pub_ver_id uuid;

  c_dims integer := 0;
  c_questions integer := 0;
  c_versions integer := 0;
  c_results integer := 0;
  c_responses integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  -- 1. Restore / Upsert Dimensions
  for v_dim in select value from jsonb_array_elements(v_dims)
  loop
    v_old_id := btrim(coalesce(v_dim ->> 'id', ''));
    v_name := btrim(coalesce(v_dim ->> 'name', ''));
    if v_name = '' then
      continue;
    end if;

    v_sort_order := coalesce(nullif(btrim(coalesce(v_dim ->> 'sort_order', '')), '')::numeric::integer, 0);
    v_weight := greatest(0, coalesce(nullif(btrim(coalesce(v_dim ->> 'weight', '')), '')::numeric, 0));
    v_target_dim_id := null;

    if v_old_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      select id into v_target_dim_id from public.dimensions where id = v_old_id::uuid;
    end if;

    if v_target_dim_id is null then
      select id into v_target_dim_id
      from public.dimensions
      where lower(btrim(name)) = lower(v_name)
      limit 1;
    end if;

    if v_target_dim_id is null and v_sort_order > 0 then
      select id into v_target_dim_id
      from public.dimensions
      where sort_order = v_sort_order
      limit 1;
    end if;

    if v_target_dim_id is not null then
      update public.dimensions
      set name = v_name,
          short_name = coalesce(v_dim ->> 'short_name', short_name),
          description = coalesce(v_dim ->> 'description', description),
          weight = v_weight,
          strength_guidance = coalesce(v_dim ->> 'strength_guidance', strength_guidance),
          development_guidance = coalesce(v_dim ->> 'development_guidance', development_guidance),
          sort_order = v_sort_order,
          is_active = coalesce(nullif(v_dim ->> 'is_active', '')::boolean, true)
      where id = v_target_dim_id;
    else
      insert into public.dimensions (
        id, name, short_name, description, weight,
        strength_guidance, development_guidance, sort_order, is_active
      ) values (
        case
          when v_old_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then v_old_id::uuid
          else gen_random_uuid()
        end,
        v_name,
        coalesce(v_dim ->> 'short_name', ''),
        coalesce(v_dim ->> 'description', ''),
        v_weight,
        coalesce(v_dim ->> 'strength_guidance', ''),
        coalesce(v_dim ->> 'development_guidance', ''),
        v_sort_order,
        coalesce(nullif(v_dim ->> 'is_active', '')::boolean, true)
      )
      returning id into v_target_dim_id;
    end if;

    if v_old_id <> '' then
      v_dim_map := jsonb_set(v_dim_map, array[v_old_id], to_jsonb(v_target_dim_id::text));
    end if;
    v_dim_map := jsonb_set(
      v_dim_map,
      array['name:' || lower(v_name)],
      to_jsonb(v_target_dim_id::text)
    );
    c_dims := c_dims + 1;
  end loop;

  -- 2. Restore / Upsert Questions
  for v_q in select value from jsonb_array_elements(v_questions)
  loop
    v_old_id := btrim(coalesce(v_q ->> 'id', ''));
    v_q_text := btrim(coalesce(v_q ->> 'question_text', v_q ->> 'text', ''));
    if v_q_text = '' then
      continue;
    end if;

    v_sort_order := coalesce(nullif(btrim(coalesce(v_q ->> 'sort_order', '')), '')::numeric::integer, 0);
    v_weight := greatest(0.01, coalesce(nullif(btrim(coalesce(v_q ->> 'weight', '')), '')::numeric, 1));
    v_target_dim_id := null;

    if coalesce(v_q ->> 'dimension_id', '') <> '' and (v_dim_map ? (v_q ->> 'dimension_id')) then
      v_target_dim_id := (v_dim_map ->> (v_q ->> 'dimension_id'))::uuid;
    elsif coalesce(v_q ->> 'dimension_name', '') <> ''
          and (v_dim_map ? ('name:' || lower(btrim(v_q ->> 'dimension_name')))) then
      v_target_dim_id := (v_dim_map ->> ('name:' || lower(btrim(v_q ->> 'dimension_name'))))::uuid;
    elsif coalesce(v_q ->> 'dimension_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      select id into v_target_dim_id from public.dimensions where id = (v_q ->> 'dimension_id')::uuid;
    end if;

    if v_target_dim_id is null and coalesce(v_q ->> 'dimension_name', '') <> '' then
      select id into v_target_dim_id
      from public.dimensions
      where lower(btrim(name)) = lower(btrim(v_q ->> 'dimension_name'))
      limit 1;
    end if;

    if v_target_dim_id is null then
      select id into v_target_dim_id from public.dimensions order by sort_order asc limit 1;
    end if;

    if v_target_dim_id is null then
      continue;
    end if;

    v_target_q_id := null;
    if v_old_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      select id into v_target_q_id from public.questions where id = v_old_id::uuid;
    end if;

    if v_target_q_id is null then
      select id into v_target_q_id
      from public.questions
      where dimension_id = v_target_dim_id
        and lower(btrim(question_text)) = lower(v_q_text)
      limit 1;
    end if;

    if v_target_q_id is null and v_sort_order > 0 then
      select id into v_target_q_id
      from public.questions
      where dimension_id = v_target_dim_id
        and sort_order = v_sort_order
      limit 1;
    end if;

    if v_target_q_id is not null then
      update public.questions
      set dimension_id = v_target_dim_id,
          question_text = v_q_text,
          weight = v_weight,
          reverse_scoring = coalesce(nullif(v_q ->> 'reverse_scoring', '')::boolean, false),
          sort_order = v_sort_order,
          is_active = coalesce(nullif(v_q ->> 'is_active', '')::boolean, true)
      where id = v_target_q_id;
    else
      insert into public.questions (
        id, dimension_id, question_text, weight, reverse_scoring, sort_order, is_active
      ) values (
        case
          when v_old_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then v_old_id::uuid
          else gen_random_uuid()
        end,
        v_target_dim_id,
        v_q_text,
        v_weight,
        coalesce(nullif(v_q ->> 'reverse_scoring', '')::boolean, false),
        v_sort_order,
        coalesce(nullif(v_q ->> 'is_active', '')::boolean, true)
      )
      returning id into v_target_q_id;
    end if;

    if v_old_id <> '' then
      v_q_map := jsonb_set(v_q_map, array[v_old_id], to_jsonb(v_target_q_id::text));
    end if;
    v_q_map := jsonb_set(v_q_map, array['text:' || lower(v_q_text)], to_jsonb(v_target_q_id::text));
    c_questions := c_questions + 1;
  end loop;

  -- 3. Restore Assessment Versions (skip existing version_number)
  for v_ver in select value from jsonb_array_elements(v_versions)
  loop
    v_ver_num := coalesce(nullif(btrim(coalesce(v_ver ->> 'version_number', '')), '')::numeric::integer, 1);
    v_snapshot := case
      when jsonb_typeof(v_ver -> 'configuration_snapshot') = 'object'
      then v_ver -> 'configuration_snapshot'
      else public.build_config_snapshot()
    end;

    begin
      v_published_at := nullif(btrim(coalesce(v_ver ->> 'published_at', '')), '')::timestamptz;
    exception when others then
      v_published_at := null;
    end;

    begin
      v_created_at := coalesce(nullif(btrim(coalesce(v_ver ->> 'created_at', '')), '')::timestamptz, now());
    exception when others then
      v_created_at := now();
    end;

    select id into v_target_ver_id
    from public.assessment_versions
    where version_number = v_ver_num;

    if v_target_ver_id is null then
      insert into public.assessment_versions (
        version_number, configuration_snapshot, status, published_at, created_at
      ) values (
        v_ver_num,
        v_snapshot,
        case when (v_ver ->> 'status') in ('draft', 'published', 'archived') then v_ver ->> 'status' else 'archived' end,
        v_published_at,
        v_created_at
      )
      returning id into v_target_ver_id;
    end if;

    v_ver_map := jsonb_set(v_ver_map, array[v_ver_num::text], to_jsonb(v_target_ver_id::text));
    c_versions := c_versions + 1;
  end loop;

  -- Ensure at least one version exists for linking restored results
  select id into v_fallback_ver_id
  from public.assessment_versions
  order by (status = 'published') desc, version_number desc
  limit 1;

  if v_fallback_ver_id is null then
    insert into public.assessment_versions (version_number, configuration_snapshot, status, published_at)
    values (1, public.build_config_snapshot(), 'published', now())
    returning id into v_fallback_ver_id;
  end if;

  -- 4. Restore Participant Results, Sessions, and Responses
  for v_res in select value from jsonb_array_elements(v_results)
  loop
    v_name := btrim(coalesce(v_res ->> 'participant_name', ''));
    v_email := nullif(btrim(coalesce(v_res ->> 'participant_email', '')), '');
    if v_name = '' then
      continue;
    end if;

    begin
      v_completed_at := coalesce(nullif(btrim(coalesce(v_res ->> 'completed_at', '')), '')::timestamptz, now());
    exception when others then
      v_completed_at := now();
    end;

    v_ver_num := coalesce(nullif(btrim(coalesce(v_res ->> 'version_number', '')), '')::numeric::integer, 1);
    v_overall_score := coalesce(nullif(btrim(coalesce(v_res ->> 'overall_score', '')), '')::numeric, 0);

    if v_ver_map ? v_ver_num::text then
      v_target_ver_id := (v_ver_map ->> v_ver_num::text)::uuid;
    else
      select id into v_target_ver_id
      from public.assessment_versions
      where version_number = v_ver_num;
      v_target_ver_id := coalesce(v_target_ver_id, v_fallback_ver_id);
    end if;

    if v_target_ver_id is null then
      continue;
    end if;

    -- Upsert participant
    if v_email is not null then
      insert into public.participants (name, email, created_at)
      values (v_name, v_email, v_completed_at)
      on conflict (lower(email)) where email is not null
      do update set name = excluded.name
      returning id into v_participant_id;
    else
      select id into v_participant_id
      from public.participants
      where lower(btrim(name)) = lower(v_name) and email is null
      limit 1;

      if v_participant_id is null then
        insert into public.participants (name, created_at)
        values (v_name, v_completed_at)
        returning id into v_participant_id;
      end if;
    end if;

    -- Enrich dimension_scores with id, short_name, sort_order from public.dimensions
    v_dim_scores := case
      when jsonb_typeof(v_res -> 'dimension_scores') = 'array'
      then v_res -> 'dimension_scores'
      else '[]'::jsonb
    end;

    v_enriched_dims := '[]'::jsonb;
    for v_ds in select value from jsonb_array_elements(v_dim_scores)
    loop
      select id, name, short_name, sort_order, weight into v_ds_dim
      from public.dimensions
      where lower(btrim(name)) = lower(btrim(coalesce(v_ds ->> 'name', '')))
      limit 1;

      if found then
        v_enriched_dims := v_enriched_dims || jsonb_build_array(
          jsonb_build_object(
            'id', v_ds_dim.id,
            'name', v_ds_dim.name,
            'short_name', v_ds_dim.short_name,
            'sort_order', v_ds_dim.sort_order,
            'weight', v_ds_dim.weight,
            'score', coalesce(nullif(btrim(coalesce(v_ds ->> 'score', '')), '')::numeric, 0),
            'category', coalesce(v_ds ->> 'category', '')
          )
        );
      else
        v_enriched_dims := v_enriched_dims || jsonb_build_array(v_ds);
      end if;
    end loop;
    v_dim_scores := v_enriched_dims;

    -- If same participant + same completed_at already exists, repair empty dimension_scores
    -- AND fall through to restore any missing granular responses (idempotent via on conflict)
    select r.id, r.assessment_session_id into v_existing_res_id, v_session_id
    from public.assessment_results r
    join public.assessment_sessions s on s.id = r.assessment_session_id
    where s.participant_id = v_participant_id
      and abs(extract(epoch from (r.created_at - v_completed_at))) < 2
    limit 1;

    if v_existing_res_id is not null then
      if jsonb_array_length(v_dim_scores) > 0 then
        update public.assessment_results
        set dimension_scores = v_dim_scores,
            result_snapshot = jsonb_set(result_snapshot, '{dimension_scores}', v_dim_scores)
        where id = v_existing_res_id
          and (jsonb_typeof(dimension_scores) <> 'array' or jsonb_array_length(dimension_scores) = 0);
      end if;
    else
      -- Create completed session
      insert into public.assessment_sessions (
        participant_id, assessment_version_id, status, started_at, completed_at
      ) values (
        v_participant_id, v_target_ver_id, 'completed', v_completed_at, v_completed_at
      )
      returning id into v_session_id;

      v_snapshot := case
        when jsonb_typeof(v_res -> 'result_snapshot') = 'object'
        then jsonb_set(v_res -> 'result_snapshot', '{dimension_scores}', v_dim_scores)
        else jsonb_build_object(
          'session_id', v_session_id,
          'version_number', v_ver_num,
          'participant_name', v_name,
          'completed_at', v_completed_at,
          'overall_score', v_overall_score,
          'category', jsonb_build_object(
            'name', coalesce(nullif(btrim(coalesce(v_res ->> 'category', '')), ''), 'Cukup Berkembang'),
            'mean', coalesce(v_res ->> 'overall_narrative', '')
          ),
          'dimension_scores', v_dim_scores,
          'config', coalesce(
            (select configuration_snapshot from public.assessment_versions where id = v_target_ver_id),
            public.build_config_snapshot()
          )
        )
      end;

      insert into public.assessment_results (
        assessment_session_id, overall_score, category, dimension_scores, result_snapshot, created_at
      ) values (
        v_session_id,
        v_overall_score,
        coalesce(nullif(btrim(coalesce(v_res ->> 'category', '')), ''), 'Cukup Berkembang'),
        v_dim_scores,
        v_snapshot,
        v_completed_at
      );

      c_results := c_results + 1;
    end if;

    -- Restore granular responses for this session
    if jsonb_typeof(v_res -> 'responses') = 'array' then
      for v_resp in select value from jsonb_array_elements(v_res -> 'responses')
      loop
        v_q_text := btrim(coalesce(v_resp -> 'question' ->> 'text', v_resp ->> 'question_text', ''));
        v_target_q_id := null;

        if coalesce(v_resp ->> 'question_id', '') <> '' and (v_q_map ? (v_resp ->> 'question_id')) then
          v_target_q_id := (v_q_map ->> (v_resp ->> 'question_id'))::uuid;
        elsif v_q_text <> '' and (v_q_map ? ('text:' || lower(v_q_text))) then
          v_target_q_id := (v_q_map ->> ('text:' || lower(v_q_text)))::uuid;
        elsif v_q_text <> '' then
          select id into v_target_q_id
          from public.questions
          where lower(btrim(question_text)) = lower(v_q_text)
          limit 1;
        elsif coalesce(v_resp ->> 'question_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
          select id into v_target_q_id
          from public.questions
          where id = (v_resp ->> 'question_id')::uuid;
        end if;

        if v_target_q_id is null then
          continue;
        end if;

        v_ans := greatest(1, least(5, coalesce(nullif(btrim(coalesce(v_resp ->> 'answer', '')), '')::numeric::integer, 3)));
        v_corr := greatest(1, least(5, coalesce(nullif(btrim(coalesce(v_resp ->> 'corrected_answer', '')), '')::numeric::integer, v_ans)));

        v_q_snap := case
          when jsonb_typeof(v_resp -> 'question') = 'object'
          then v_resp -> 'question'
          else jsonb_build_object(
            'id', v_target_q_id,
            'text', v_q_text,
            'sort_order', coalesce(nullif(btrim(coalesce(v_resp ->> 'sort_order', '')), '')::numeric::integer, 0),
            'reverse_scoring', coalesce(nullif(v_resp ->> 'reverse_scoring', '')::boolean, false)
          )
        end;

        insert into public.responses (
          assessment_session_id, question_id, question_snapshot, answer, corrected_answer, created_at
        ) values (
          v_session_id,
          v_target_q_id,
          v_q_snap,
          v_ans,
          v_corr,
          v_completed_at
        )
        on conflict (assessment_session_id, question_id) do nothing;

        c_responses := c_responses + 1;
      end loop;
    end if;
  end loop;

  -- Refresh latest published version snapshot & working draft so live assessment
  -- always references valid question_ids in this target database
  if c_dims > 0 or c_questions > 0 then
    select id into v_pub_ver_id
    from public.assessment_versions
    where status = 'published'
    order by version_number desc
    limit 1;

    if v_pub_ver_id is not null then
      update public.assessment_versions
      set configuration_snapshot = public.build_config_snapshot()
      where id = v_pub_ver_id;
    end if;

    perform public.save_assessment_draft();
  end if;

  return jsonb_build_object(
    'dimensions', c_dims,
    'questions', c_questions,
    'versions', c_versions,
    'results', c_results,
    'responses', c_responses
  );
end;
$$;

revoke all on function public.admin_restore_full_backup(jsonb) from public, anon;
grant execute on function public.admin_restore_full_backup(jsonb) to authenticated;
