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
