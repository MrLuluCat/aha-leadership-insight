import { requireClient } from '../lib/supabase'

export async function fetchActiveAssessment() {
  const { data, error } = await requireClient().rpc('get_active_assessment')
  if (error) throw error
  return data
}

export async function startAssessment(name, email) {
  const { data, error } = await requireClient().rpc('start_assessment', {
    p_name: name,
    p_email: email || null,
  })
  if (error) throw error
  return data
}

export async function submitAssessment(sessionId, accessToken, answers) {
  const { data, error } = await requireClient().rpc('submit_assessment', {
    p_session_id: sessionId,
    p_access_token: accessToken,
    p_answers: answers,
  })
  if (error) throw error
  return data
}

export async function fetchAssessmentResult(sessionId, accessToken) {
  const { data, error } = await requireClient().rpc('get_assessment_result', {
    p_session_id: sessionId,
    p_access_token: accessToken,
  })
  if (error) throw error
  return data
}
