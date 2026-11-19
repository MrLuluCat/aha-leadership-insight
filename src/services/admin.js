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
  // Tryassessment_results or results table, or RPC if available
  const { error: resErr } = await client.from('assessment_results').delete().eq('id', resultId)
  if (!resErr) return true
  const { error: altErr } = await client.from('results').delete().eq('id', resultId)
  if (!altErr) return true
  throw new Error(resErr.message || 'Penghapusan hasil memerlukan izin RLS DELETE pada tabel assessment_results di Supabase.')
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
    safeSelectTable('assessment_results', 'completed_at'),
    safeSelectTable('assessment_responses', 'created_at'),
  ])

  return {
    profiles: profiles ?? [],
    participants: participants ?? [],
    assessment_sessions: sessions ?? [],
    assessment_results: rawResults ?? [],
    assessment_responses: rawResponses ?? [],
  }
}


