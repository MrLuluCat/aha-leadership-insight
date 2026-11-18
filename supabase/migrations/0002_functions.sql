-- AHA Leadership Insight - RPC functions
-- Run after 0001_schema.sql.

-- ---------------------------------------------------------------------------
-- Category rules live inside every version snapshot.
-- ---------------------------------------------------------------------------

create or replace function public.category_rules()
returns jsonb
language sql
immutable
as $$
  select '[
    {"min": 90, "name": "Sangat Kuat", "mean": "Kemampuan menjadi salah satu kekuatan utama."},
    {"min": 75, "name": "Kuat", "mean": "Kemampuan relatif konsisten dalam berbagai situasi."},
    {"min": 50, "name": "Cukup Berkembang", "mean": "Kemampuan terlihat dan masih dapat ditingkatkan."},
    {"min": 25, "name": "Tahap Pengembangan", "mean": "Kemampuan mulai terbentuk tetapi belum konsisten."},
    {"min": 0, "name": "Perlu Penguatan Mendasar", "mean": "Kemampuan memerlukan perhatian dan pendampingan khusus."}
  ]'::jsonb;
$$;

revoke all on function public.category_rules() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Build a snapshot of the current working configuration (active rows only).
-- ---------------------------------------------------------------------------

create or replace function public.build_config_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'dimensions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'name', d.name,
        'short_name', d.short_name,
        'description', d.description,
        'weight', d.weight,
        'strength_guidance', d.strength_guidance,
        'development_guidance', d.development_guidance,
        'sort_order', d.sort_order
      ) order by d.sort_order, d.name)
      from public.dimensions d
      where d.is_active
    ), '[]'::jsonb),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'dimension_id', q.dimension_id,
        'text', q.question_text,
        'weight', q.weight,
        'reverse_scoring', q.reverse_scoring,
        'sort_order', q.sort_order
      ) order by q.sort_order, q.created_at)
      from public.questions q
      join public.dimensions d on d.id = q.dimension_id
      where q.is_active and d.is_active
    ), '[]'::jsonb),
    'categories', public.category_rules(),
    'generated_at', now()
  );
$$;

revoke all on function public.build_config_snapshot() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Configuration validation (used before publishing).
-- ---------------------------------------------------------------------------

create or replace function public.validate_configuration(p_config jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_dims jsonb := coalesce(p_config -> 'dimensions', '[]'::jsonb);
  v_questions jsonb := coalesce(p_config -> 'questions', '[]'::jsonb);
  v_dim jsonb;
  v_question jsonb;
  v_total numeric := 0;
  v_count integer;
begin
  if jsonb_array_length(v_dims) <> 7 then
    raise exception 'Asesmen harus memiliki tepat tujuh dimensi aktif.';
  end if;

  for v_dim in select value from jsonb_array_elements(v_dims)
  loop
    if (v_dim ->> 'weight')::numeric <= 0 then
      raise exception 'Bobot dimensi "%" harus lebih besar dari 0.', v_dim ->> 'name';
    end if;
    v_total := v_total + (v_dim ->> 'weight')::numeric;

    select count(*) into v_count
    from jsonb_array_elements(v_questions) q
    where q ->> 'dimension_id' = v_dim ->> 'id';

    if v_count = 0 then
      raise exception 'Dimensi "%" harus memiliki minimal satu pertanyaan aktif.', v_dim ->> 'name';
    end if;
  end loop;

  if abs(v_total - 100) > 0.01 then
    raise exception 'Total bobot dimensi aktif harus 100%% (saat ini %).', round(v_total, 2);
  end if;

  for v_question in select value from jsonb_array_elements(v_questions)
  loop
    if (v_question ->> 'weight')::numeric <= 0 then
      raise exception 'Bobot setiap pertanyaan harus lebih besar dari 0.';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(v_dims) d
      where d ->> 'id' = v_question ->> 'dimension_id'
    ) then
      raise exception 'Pertanyaan memiliki dimensi yang tidak valid.';
    end if;
  end loop;
end;
$$;

revoke all on function public.validate_configuration(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: active assessment configuration
-- ---------------------------------------------------------------------------

create or replace function public.get_active_assessment()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version_id', v.id,
    'version_number', v.version_number,
    'config', v.configuration_snapshot
  )
  from public.assessment_versions v
  where v.status = 'published'
  order by v.version_number desc
  limit 1;
$$;

grant execute on function public.get_active_assessment() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: start an assessment session
-- ---------------------------------------------------------------------------

create or replace function public.start_assessment(p_name text, p_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := nullif(btrim(coalesce(p_email, '')), '');
  v_version public.assessment_versions;
  v_participant_id uuid;
  v_session_id uuid;
  v_token uuid;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 200 then
    raise exception 'Nama peserta wajib diisi (maksimal 200 karakter).';
  end if;

  if v_email is not null and (char_length(v_email) > 320 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Format email tidak valid.';
  end if;

  select * into v_version
  from public.assessment_versions
  where status = 'published'
  order by version_number desc
  limit 1;

  if not found then
    raise exception 'Asesmen belum tersedia. Silakan hubungi administrator.';
  end if;

  if v_email is not null then
    insert into public.participants (name, email)
    values (v_name, v_email)
    on conflict (lower(email)) where email is not null
    do update set name = excluded.name
    returning id into v_participant_id;
  else
    insert into public.participants (name)
    values (v_name)
    returning id into v_participant_id;
  end if;

  insert into public.assessment_sessions (participant_id, assessment_version_id)
  values (v_participant_id, v_version.id)
  returning id, access_token into v_session_id, v_token;

  return jsonb_build_object(
    'session_id', v_session_id,
    'access_token', v_token,
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'participant_name', v_name,
    'config', v_version.configuration_snapshot
  );
end;
$$;

grant execute on function public.start_assessment(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: submit answers, score on the server, persist result
-- ---------------------------------------------------------------------------

create or replace function public.submit_assessment(
  p_session_id uuid,
  p_access_token uuid,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.assessment_sessions;
  v_version public.assessment_versions;
  v_config jsonb;
  v_participant_name text;
  v_existing public.assessment_results;
  v_answer_count integer;
  v_dim jsonb;
  v_question jsonb;
  v_category jsonb;
  v_dim_category jsonb;
  v_answer integer;
  v_corrected integer;
  v_question_score numeric;
  v_dim_total numeric;
  v_dim_weight numeric;
  v_dim_score numeric;
  v_dim_scores jsonb := '[]'::jsonb;
  v_overall numeric := 0;
  v_result jsonb;
begin
  select s.*
  into v_session
  from public.assessment_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception 'Sesi asesmen tidak ditemukan.';
  end if;

  select p.name into v_participant_name
  from public.participants p
  where p.id = v_session.participant_id;

  if p_access_token is null or v_session.access_token <> p_access_token then
    raise exception 'Sesi asesmen tidak valid.';
  end if;

  if v_session.status = 'completed' then
    select * into v_existing
    from public.assessment_results
    where assessment_session_id = p_session_id;
    if found then
      return v_existing.result_snapshot;
    end if;
    raise exception 'Sesi asesmen sudah diselesaikan.';
  end if;

  select * into v_version
  from public.assessment_versions
  where id = v_session.assessment_version_id;

  if not found then
    raise exception 'Versi asesmen tidak ditemukan.';
  end if;

  v_config := v_version.configuration_snapshot;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Format jawaban tidak valid.';
  end if;

  select count(*) into v_answer_count from jsonb_object_keys(p_answers);

  if v_answer_count <> jsonb_array_length(v_config -> 'questions') then
    raise exception 'Seluruh pertanyaan wajib dijawab sebelum mengirim.';
  end if;

  for v_question in select value from jsonb_array_elements(v_config -> 'questions')
  loop
    if p_answers ->> (v_question ->> 'id') is null then
      raise exception 'Masih ada pertanyaan yang belum dijawab.';
    end if;
    begin
      v_answer := (p_answers ->> (v_question ->> 'id'))::integer;
    exception when others then
      raise exception 'Jawaban tidak valid.';
    end;
    if v_answer < 1 or v_answer > 5 then
      raise exception 'Jawaban harus berada pada skala 1 sampai 5.';
    end if;

    v_corrected := case
      when (v_question ->> 'reverse_scoring')::boolean then 6 - v_answer
      else v_answer
    end;

    insert into public.responses (
      assessment_session_id, question_id, question_snapshot, answer, corrected_answer
    ) values (
      p_session_id, (v_question ->> 'id')::uuid, v_question, v_answer, v_corrected
    );
  end loop;

  for v_dim in select value from jsonb_array_elements(v_config -> 'dimensions')
  loop
    v_dim_total := 0;
    v_dim_weight := 0;

    for v_question in
      select value from jsonb_array_elements(v_config -> 'questions')
      where value ->> 'dimension_id' = v_dim ->> 'id'
    loop
      v_answer := (p_answers ->> (v_question ->> 'id'))::integer;
      v_corrected := case
        when (v_question ->> 'reverse_scoring')::boolean then 6 - v_answer
        else v_answer
      end;
      v_question_score := ((v_corrected - 1)::numeric / 4) * 100;
      v_dim_total := v_dim_total + (v_question_score * (v_question ->> 'weight')::numeric);
      v_dim_weight := v_dim_weight + (v_question ->> 'weight')::numeric;
    end loop;

    if v_dim_weight <= 0 then
      raise exception 'Dimensi "%" tidak memiliki bobot pertanyaan yang valid.', v_dim ->> 'name';
    end if;

    v_dim_score := v_dim_total / v_dim_weight;

    v_dim_category := null;
    for v_category in select value from jsonb_array_elements(v_config -> 'categories')
    loop
      if v_dim_score >= (v_category ->> 'min')::numeric then
        v_dim_category := v_category;
        exit;
      end if;
    end loop;

    v_dim_scores := v_dim_scores || jsonb_build_array(jsonb_build_object(
      'id', v_dim ->> 'id',
      'name', v_dim ->> 'name',
      'short_name', v_dim ->> 'short_name',
      'score', v_dim_score,
      'weight', (v_dim ->> 'weight')::numeric,
      'sort_order', (v_dim ->> 'sort_order')::integer,
      'category', v_dim_category ->> 'name'
    ));

    v_overall := v_overall + (v_dim_score * (v_dim ->> 'weight')::numeric / 100);
  end loop;

  v_category := null;
  for v_category in select value from jsonb_array_elements(v_config -> 'categories')
  loop
    if v_overall >= (v_category ->> 'min')::numeric then
      exit;
    end if;
  end loop;

  v_result := jsonb_build_object(
    'participant_name', v_participant_name,
    'overall_score', v_overall,
    'category', v_category,
    'dimension_scores', v_dim_scores,
    'config', v_config,
    'version_number', v_version.version_number,
    'completed_at', now()
  );

  update public.assessment_sessions
  set status = 'completed', completed_at = now()
  where id = p_session_id;

  insert into public.assessment_results (
    assessment_session_id, overall_score, category, dimension_scores, result_snapshot
  ) values (
    p_session_id, v_overall, v_category ->> 'name', v_dim_scores, v_result
  );

  return v_result;
end;
$$;

grant execute on function public.submit_assessment(uuid, uuid, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public: retrieve a completed result using the session access token
-- ---------------------------------------------------------------------------

create or replace function public.get_assessment_result(p_session_id uuid, p_access_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select r.result_snapshot
  from public.assessment_results r
  join public.assessment_sessions s on s.id = r.assessment_session_id
  where s.id = p_session_id
    and s.access_token = p_access_token
    and s.status = 'completed'
  limit 1;
$$;

grant execute on function public.get_assessment_result(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: save the working draft
-- ---------------------------------------------------------------------------

create or replace function public.save_assessment_draft()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_draft public.assessment_versions;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  perform pg_advisory_xact_lock(hashtext('aha_assessment_versions'));

  v_config := public.build_config_snapshot();

  select * into v_draft
  from public.assessment_versions
  where status = 'draft'
  order by version_number desc
  limit 1
  for update;

  if found then
    update public.assessment_versions
    set configuration_snapshot = v_config
    where id = v_draft.id
    returning * into v_draft;
  else
    insert into public.assessment_versions (version_number, configuration_snapshot, status)
    values (
      coalesce((select max(version_number) from public.assessment_versions), 0) + 1,
      v_config,
      'draft'
    )
    returning * into v_draft;
  end if;

  return jsonb_build_object(
    'id', v_draft.id,
    'version_number', v_draft.version_number,
    'status', v_draft.status,
    'configuration_snapshot', v_draft.configuration_snapshot,
    'created_at', v_draft.created_at
  );
end;
$$;

revoke all on function public.save_assessment_draft() from public, anon;
grant execute on function public.save_assessment_draft() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: atomically save the working configuration (dimensions + questions)
-- ---------------------------------------------------------------------------

create or replace function public.save_configuration(
  p_dimensions jsonb,
  p_questions jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dim jsonb;
  v_question jsonb;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  if jsonb_typeof(p_dimensions) <> 'array' or jsonb_typeof(p_questions) <> 'array' then
    raise exception 'Format konfigurasi tidak valid.';
  end if;

  for v_dim in select value from jsonb_array_elements(p_dimensions)
  loop
    if btrim(coalesce(v_dim ->> 'name', '')) = '' then
      raise exception 'Nama dimensi wajib diisi.';
    end if;
    if (v_dim ->> 'weight') is null or (v_dim ->> 'weight')::numeric < 0 then
      raise exception 'Bobot dimensi tidak valid.';
    end if;

    update public.dimensions
    set name = btrim(v_dim ->> 'name'),
        short_name = coalesce(v_dim ->> 'short_name', ''),
        description = coalesce(v_dim ->> 'description', ''),
        weight = (v_dim ->> 'weight')::numeric,
        strength_guidance = coalesce(v_dim ->> 'strength_guidance', ''),
        development_guidance = coalesce(v_dim ->> 'development_guidance', ''),
        sort_order = coalesce((v_dim ->> 'sort_order')::integer, 0),
        is_active = coalesce((v_dim ->> 'is_active')::boolean, true)
    where id = (v_dim ->> 'id')::uuid;

    if not found then
      raise exception 'Dimensi tidak ditemukan.';
    end if;
  end loop;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    if (v_question ->> 'weight') is null or (v_question ->> 'weight')::numeric <= 0 then
      raise exception 'Bobot setiap pertanyaan harus lebih besar dari 0.';
    end if;

    update public.questions
    set weight = (v_question ->> 'weight')::numeric,
        reverse_scoring = coalesce((v_question ->> 'reverse_scoring')::boolean, false),
        is_active = coalesce((v_question ->> 'is_active')::boolean, true),
        dimension_id = coalesce((v_question ->> 'dimension_id')::uuid, dimension_id),
        sort_order = coalesce((v_question ->> 'sort_order')::integer, sort_order)
    where id = (v_question ->> 'id')::uuid;

    if not found then
      raise exception 'Pertanyaan tidak ditemukan.';
    end if;
  end loop;
end;
$$;

revoke all on function public.save_configuration(jsonb, jsonb) from public, anon;
grant execute on function public.save_configuration(jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: publish the draft as a new immutable version
-- ---------------------------------------------------------------------------

create or replace function public.publish_assessment()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config jsonb;
  v_draft public.assessment_versions;
  v_published public.assessment_versions;
  v_next_number integer;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  perform pg_advisory_xact_lock(hashtext('aha_assessment_versions'));

  v_config := public.build_config_snapshot();
  perform public.validate_configuration(v_config);

  select * into v_draft
  from public.assessment_versions
  where status = 'draft'
  order by version_number desc
  limit 1
  for update;

  if not found then
    insert into public.assessment_versions (version_number, configuration_snapshot, status)
    values (
      coalesce((select max(version_number) from public.assessment_versions), 0) + 1,
      v_config,
      'draft'
    )
    returning * into v_draft;
  end if;

  update public.assessment_versions
  set status = 'archived'
  where status = 'published';

  update public.assessment_versions
  set configuration_snapshot = v_config,
      status = 'published',
      published_at = now()
  where id = v_draft.id
  returning * into v_published;

  v_next_number := (select max(version_number) from public.assessment_versions) + 1;

  insert into public.assessment_versions (version_number, configuration_snapshot, status)
  values (v_next_number, v_config, 'draft');

  return jsonb_build_object(
    'id', v_published.id,
    'version_number', v_published.version_number,
    'status', v_published.status,
    'published_at', v_published.published_at
  );
end;
$$;

revoke all on function public.publish_assessment() from public, anon;
grant execute on function public.publish_assessment() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: overview statistics
-- ---------------------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dims jsonb;
  v_categories jsonb;
  v_trend jsonb;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'name', t.name,
           'short_name', t.short_name,
           'score', round(t.score, 2),
           'sort_order', t.sort_order
         ) order by t.sort_order nulls last, t.name), '[]'::jsonb)
  into v_dims
  from (
    select d ->> 'id' as id,
           (array_agg(d ->> 'name' order by r.created_at desc))[1] as name,
           (array_agg(d ->> 'short_name' order by r.created_at desc))[1] as short_name,
           avg((d ->> 'score')::numeric) as score,
           min((d ->> 'sort_order')::integer) as sort_order
    from public.assessment_results r
    cross join lateral jsonb_array_elements(r.dimension_scores) d
    group by 1
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'count', c.cnt) order by c.cnt desc), '[]'::jsonb)
  into v_categories
  from (
    select category as name, count(*) as cnt
    from public.assessment_results
    group by 1
  ) c;

  select coalesce(jsonb_agg(jsonb_build_object(
           'period', to_char(t.period, 'YYYY-MM'),
           'count', t.cnt
         ) order by t.period), '[]'::jsonb)
  into v_trend
  from (
    select date_trunc('month', created_at) as period, count(*) as cnt
    from public.assessment_results
    where created_at >= date_trunc('month', now()) - interval '11 months'
    group by 1
  ) t;

  return jsonb_build_object(
    'total_participants', (select count(*) from public.participants),
    'total_completed', (select count(*) from public.assessment_results),
    'total_in_progress', (select count(*) from public.assessment_sessions where status = 'in_progress'),
    'avg_overall', (select coalesce(round(avg(overall_score), 2), 0) from public.assessment_results),
    'dimensions', v_dims,
    'categories', v_categories,
    'trend', v_trend
  );
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: paginated results list
-- ---------------------------------------------------------------------------

create or replace function public.admin_results_page(
  p_search text default null,
  p_category text default null,
  p_from date default null,
  p_to date default null,
  p_sort text default 'date',
  p_dir text default 'desc',
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_rows jsonb;
  v_sort text := case when p_sort in ('name', 'date', 'overall') then p_sort else 'date' end;
  v_dir text := case when p_dir = 'asc' then 'asc' else 'desc' end;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  select coalesce(max(t.total), 0), coalesce(jsonb_agg(t.rec), '[]'::jsonb)
  into v_total, v_rows
  from (
    select
      count(*) over() as total,
      jsonb_build_object(
        'result_id', r.id,
        'session_id', s.id,
        'participant_id', p.id,
        'participant_name', p.name,
        'participant_email', p.email,
        'assessment_date', r.created_at,
        'overall_score', r.overall_score,
        'category', r.category,
        'version_number', v.version_number
      ) as rec
    from public.assessment_results r
    join public.assessment_sessions s on s.id = r.assessment_session_id
    join public.participants p on p.id = s.participant_id
    join public.assessment_versions v on v.id = s.assessment_version_id
    where (p_search is null or btrim(p_search) = '' or p.name ilike '%' || btrim(p_search) || '%')
      and (p_category is null or p_category = '' or r.category = p_category)
      and (p_from is null or r.created_at::date >= p_from)
      and (p_to is null or r.created_at::date <= p_to)
    order by
      case when v_sort = 'name' and v_dir = 'asc' then p.name end asc,
      case when v_sort = 'name' and v_dir = 'desc' then p.name end desc,
      case when v_sort = 'overall' and v_dir = 'asc' then r.overall_score end asc,
      case when v_sort = 'overall' and v_dir = 'desc' then r.overall_score end desc,
      case when v_sort = 'date' and v_dir = 'asc' then r.created_at end asc,
      case when v_sort = 'date' and v_dir = 'desc' then r.created_at end desc,
      r.created_at desc
    limit greatest(coalesce(p_limit, 10), 0)
    offset greatest(coalesce(p_offset, 0), 0)
  ) t;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

revoke all on function public.admin_results_page(text, text, date, date, text, text, integer, integer) from public, anon;
grant execute on function public.admin_results_page(text, text, date, date, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: one result with identity, version, and answers
-- ---------------------------------------------------------------------------

create or replace function public.admin_result_detail(p_result_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  select jsonb_build_object(
    'result', r.result_snapshot,
    'participant', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'email', p.email
    ),
    'version', jsonb_build_object(
      'id', v.id,
      'version_number', v.version_number,
      'published_at', v.published_at
    ),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', resp.question_id,
        'question', resp.question_snapshot,
        'answer', resp.answer,
        'corrected_answer', resp.corrected_answer
      ) order by (resp.question_snapshot ->> 'sort_order')::integer)
      from public.responses resp
      where resp.assessment_session_id = s.id
    ), '[]'::jsonb)
  )
  into v_payload
  from public.assessment_results r
  join public.assessment_sessions s on s.id = r.assessment_session_id
  join public.participants p on p.id = s.participant_id
  join public.assessment_versions v on v.id = s.assessment_version_id
  where r.id = p_result_id;

  return v_payload;
end;
$$;

revoke all on function public.admin_result_detail(uuid) from public, anon;
grant execute on function public.admin_result_detail(uuid) to authenticated;
