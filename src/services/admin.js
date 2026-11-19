import { requireClient } from '../lib/supabase'

export async function fetchProfile(userId) {
  const { data, error } = await requireClient()
    .from('profiles')
    .select('id,email,role,is_active')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchOverview() {
  const { data, error } = await requireClient().rpc('admin_overview')
  if (error) throw error
  return data
}

export async function fetchResultsPage({
  search = '',
  category = '',
  from = '',
  to = '',
  sort = 'date',
  dir = 'desc',
  limit = 10,
  offset = 0,
} = {}) {
  const { data, error } = await requireClient().rpc('admin_results_page', {
    p_search: search || null,
    p_category: category || null,
    p_from: from || null,
    p_to: to || null,
    p_sort: sort,
    p_dir: dir,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return data ?? { total: 0, rows: [] }
}

export async function fetchResultDetail(resultId) {
  const { data, error } = await requireClient().rpc('admin_result_detail', {
    p_result_id: resultId,
  })
  if (error) throw error
  return data
}

export async function fetchDimensions() {
  const { data, error } = await requireClient()
    .from('dimensions')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

export async function fetchQuestions() {
  const { data, error } = await requireClient()
    .from('questions')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data
}

export async function createQuestion(row) {
  const { data, error } = await requireClient().from('questions').insert(row).select().single()
  if (error) throw error
  return data
}

export async function updateQuestion(id, patch) {
  const { data, error } = await requireClient()
    .from('questions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteQuestion(id) {
  const { error } = await requireClient().from('questions').delete().eq('id', id)
  if (error) throw error
}

export async function updateDimension(id, patch) {
  const { data, error } = await requireClient()
    .from('dimensions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createDimension(row) {
  const { data, error } = await requireClient().from('dimensions').insert(row).select().single()
  if (error) throw error
  return data
}

export async function fetchVersions() {
  const { data, error } = await requireClient()
    .from('assessment_versions')
    .select('id,version_number,status,published_at,created_at,configuration_snapshot')
    .order('version_number', { ascending: false })
  if (error) throw error
  return data
}

export async function saveConfiguration(dimensions, questions) {
  const { error } = await requireClient().rpc('save_configuration', {
    p_dimensions: dimensions,
    p_questions: questions,
  })
  if (error) throw error
}

export async function saveDraft() {
  const { data, error } = await requireClient().rpc('save_assessment_draft')
  if (error) throw error
  return data
}

export async function publishAssessment() {
  const { data, error } = await requireClient().rpc('publish_assessment')
  if (error) throw error
  return data
}

export async function fetchAllResultsList() {
  const allRows = []
  const chunk = 500
  let offset = 0
  let totalRows = Infinity

  while (offset < totalRows) {
    const chunkData = await fetchResultsPage({
      limit: chunk,
      offset,
      sort: 'date',
      dir: 'desc',
    })
    const rowsChunk = chunkData.rows ?? []
    allRows.push(...rowsChunk)
    totalRows = Number(chunkData.total ?? 0)
    offset += chunk
    if (!rowsChunk.length) break
  }
  return allRows
}

export async function deleteResultRecord(resultId) {
  const client = requireClient()
  const { error: rpcErr } = await client.rpc('admin_delete_result', { p_result_id: resultId })
  if (!rpcErr) return true
  const { error: resErr } = await client.from('assessment_results').delete().eq('id', resultId)
  if (!resErr) return true
  throw new Error(
    rpcErr.message ||
      resErr.message ||
      'Penghapusan hasil memerlukan migrasi 0004_restore_rpc.sql pada Supabase SQL Editor.'
  )
}

export async function restoreFullBackupRpc(payload) {
  const { data, error } = await requireClient().rpc('admin_restore_full_backup', {
    p_payload: payload,
  })
  if (error) {
    const msg = String(error.message || '')
    const isMissingFn =
      error.code === 'PGRST202' ||
      msg.includes('Could not find the function') ||
      msg.includes('admin_restore_full_backup')
    if (isMissingFn) {
      return { rpcMissing: true, error: msg }
    }
    throw error
  }
  return { rpcMissing: false, counts: data }
}

export async function restoreConfigCrossDb(backupDims, backupQs, existingDims, existingQs) {
  const norm = (s) => String(s || '').trim().toLowerCase()
  const dimIdMap = new Map()
  const dimNameMap = new Map()
  const currentDims = [...(existingDims ?? [])]
  const currentQs = [...(existingQs ?? [])]

  let syncedDims = 0
  let syncedQs = 0

  for (const d of backupDims ?? []) {
    const match =
      currentDims.find((ex) => d.id && ex.id === d.id) ||
      currentDims.find((ex) => norm(ex.name) === norm(d.name)) ||
      currentDims.find((ex) => Number(ex.sort_order) === Number(d.sort_order))

    const patch = {
      name: String(d.name || 'Dimensi').trim(),
      short_name: d.short_name ?? '',
      description: d.description ?? '',
      weight: Math.max(0, Number(d.weight ?? 0)),
      strength_guidance: d.strength_guidance ?? '',
      development_guidance: d.development_guidance ?? '',
      sort_order: Number(d.sort_order ?? 0),
      is_active: d.is_active !== false,
    }

    let saved
    if (match) {
      saved = await updateDimension(match.id, patch)
    } else {
      saved = await createDimension(patch)
      currentDims.push(saved)
    }
    if (d.id) dimIdMap.set(d.id, saved.id)
    dimNameMap.set(norm(saved.name), saved.id)
    if (d.name) dimNameMap.set(norm(d.name), saved.id)
    syncedDims++
  }

  for (const ex of currentDims) {
    if (!dimNameMap.has(norm(ex.name))) {
      dimNameMap.set(norm(ex.name), ex.id)
    }
  }

  const fallbackDimId = currentDims[0]?.id ?? null

  for (const q of backupQs ?? []) {
    const qText = String(q.question_text ?? q.text ?? '').trim()
    if (!qText) continue

    const targetDimId =
      (q.dimension_id && dimIdMap.get(q.dimension_id)) ||
      (q.dimension_name && dimNameMap.get(norm(q.dimension_name))) ||
      (q.dimension_id && currentDims.find((d) => d.id === q.dimension_id)?.id) ||
      fallbackDimId

    if (!targetDimId) continue

    const match =
      currentQs.find((ex) => q.id && ex.id === q.id) ||
      currentQs.find(
        (ex) => ex.dimension_id === targetDimId && norm(ex.question_text) === norm(qText)
      ) ||
      currentQs.find(
        (ex) =>
          ex.dimension_id === targetDimId &&
          Number(ex.sort_order) === Number(q.sort_order)
      )

    const patch = {
      dimension_id: targetDimId,
      question_text: qText,
      weight: Math.max(0.01, Number(q.weight ?? 1)),
      reverse_scoring: Boolean(q.reverse_scoring),
      sort_order: Number(q.sort_order ?? 0),
      is_active: q.is_active !== false,
    }

    if (match) {
      await updateQuestion(match.id, patch)
    } else {
      const created = await createQuestion(patch)
      currentQs.push(created)
    }
    syncedQs++
  }

  return { dimensions: syncedDims, questions: syncedQs }
}

async function safeSelectTable(tableName, orderByCol = 'created_at') {
  try {
    const client = requireClient()
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .order(orderByCol, { ascending: false })
    if (!error && Array.isArray(data)) return data
    const fallback = await client.from(tableName).select('*')
    if (!fallback.error && Array.isArray(fallback.data)) return fallback.data
    return null
  } catch {
    return null
  }
}

export async function fetchAllDatabaseTables() {
  const [
    profiles,
    participants,
    sessions,
    rawResults,
    rawResponses,
  ] = await Promise.all([
    safeSelectTable('profiles', 'email'),
    safeSelectTable('participants', 'created_at'),
    safeSelectTable('assessment_sessions', 'started_at'),
    safeSelectTable('assessment_results', 'created_at'),
    safeSelectTable('responses', 'created_at'),
  ])

  return {
    profiles: profiles ?? [],
    participants: participants ?? [],
    assessment_sessions: sessions ?? [],
    assessment_results: rawResults ?? [],
    responses: rawResponses ?? [],
  }
}


