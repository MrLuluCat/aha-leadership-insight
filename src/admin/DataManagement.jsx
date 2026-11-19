import { useEffect, useMemo, useRef, useState } from 'react'
import { dfmt, dtfmt, fmt, tfmt } from '../lib/format'
import { buildReport } from '../lib/report'
import {
  deleteResultRecord,
  fetchAllDatabaseTables,
  fetchAllResultsList,
  fetchDimensions,
  fetchQuestions,
  fetchResultDetail,
  fetchVersions,
  saveConfiguration,
  saveDraft,
} from '../services/admin'
import CustomSelect from './CustomSelect'

const BACKUP_LOG_KEY = 'aha_admin_backup_logs_v1'
const SCALE_LABELS = ['Sangat Jarang', 'Jarang', 'Kadang-kadang', 'Sering', 'Sangat Sering']

function toCsvCell(val) {
  return `"${String(val ?? '').replace(/"/g, '""')}"`
}

function buildCsvString(headers, rows) {
  const lines = [headers.map(toCsvCell).join(',')]
  for (const row of rows) {
    lines.push(row.map(toCsvCell).join(','))
  }
  return '\uFEFF' + lines.join('\r\n')
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

function parseCsvText(text) {
  const clean = text.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    const next = clean[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(cell)
        cell = ''
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++
        row.push(cell)
        if (row.some((c) => c.trim() !== '')) rows.push(row)
        row = []
        cell = ''
      } else {
        cell += ch
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    if (row.some((c) => c.trim() !== '')) rows.push(row)
  }
  if (!rows.length) return { headers: [], items: [] }
  const headers = rows[0].map((h) => h.trim())
  const items = rows.slice(1).map((r) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? ''
    })
    return obj
  })
  return { headers, items }
}

function loadBackupLogs() {
  try {
    const raw = localStorage.getItem(BACKUP_LOG_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function DataManagement() {
  const [subTab, setSubTab] = useState('backup')
  const [loading, setLoading] = useState(true)
  const [busyLabel, setBusyLabel] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [dimensions, setDimensions] = useState([])
  const [questions, setQuestions] = useState([])
  const [versions, setVersions] = useState([])
  const [results, setResults] = useState([])
  const [rawDbTables, setRawDbTables] = useState({
    profiles: [],
    participants: [],
    assessment_sessions: [],
    assessment_results: [],
    assessment_responses: [],
  })
  const [backupLogs, setBackupLogs] = useState(loadBackupLogs)

  // Restore state
  const [restorePreview, setRestorePreview] = useState(null)
  const fileInputRef = useRef(null)

  // Maintenance / Cleanup DataTable state
  const [cleanSearch, setCleanSearch] = useState('')
  const [cleanMode, setCleanMode] = useState('all') // 'all' | 'duplicates' | 'test'
  const [selectedIds, setSelectedIds] = useState([])
  const [cleanPage, setCleanPage] = useState(0)
  const [cleanPageSize, setCleanPageSize] = useState(10)
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false)
  const [confirmWord, setConfirmWord] = useState('')

  async function loadAllData() {
    setLoading(true)
    setError('')
    try {
      const [dims, qs, vers, resList, dbTables] = await Promise.all([
        fetchDimensions(),
        fetchQuestions(),
        fetchVersions(),
        fetchAllResultsList(),
        fetchAllDatabaseTables(),
      ])
      setDimensions(dims ?? [])
      setQuestions(qs ?? [])
      setVersions(vers ?? [])
      setResults(resList ?? [])
      if (dbTables) setRawDbTables(dbTables)
    } catch (err) {
      setError(err.message || 'Gagal memuat ringkasan dataset.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  function recordBackupLog(typeLabel, format, rowCount) {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      typeLabel,
      format,
      rowCount,
    }
    const next = [entry, ...backupLogs].slice(0, 15)
    setBackupLogs(next)
    try {
      localStorage.setItem(BACKUP_LOG_KEY, JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

  const dimMap = useMemo(() => {
    const map = {}
    for (const d of dimensions) map[d.id] = d
    return map
  }, [dimensions])

  // Health & Diagnostics calculation
  const diagnostics = useMemo(() => {
    const activeDims = dimensions.filter((d) => d.is_active)
    const activeQs = questions.filter((q) => q.is_active)
    const totalWeight = activeDims.reduce((sum, d) => sum + Number(d.weight || 0), 0)
    const weightOk = Math.abs(totalWeight - 100) < 0.01

    const dimsWithoutQuestions = activeDims.filter(
      (d) => !activeQs.some((q) => q.dimension_id === d.id)
    )
    const orphanQuestions = questions.filter((q) => !dimMap[q.dimension_id])
    const publishedVersions = versions.filter((v) => v.status === 'published')
    const latestPublished = publishedVersions[0] ?? null

    // Detect duplicate emails/names on the same assessment date
    const seen = new Map()
    const duplicateIds = new Set()
    for (const r of results) {
      const key = `${(r.participant_email || r.participant_name || '').trim().toLowerCase()}__${dfmt(r.assessment_date)}`
      if (!key.startsWith('__')) {
        if (seen.has(key)) {
          duplicateIds.add(r.result_id)
        } else {
          seen.set(key, r.result_id)
        }
      }
    }

    const healthy =
      weightOk &&
      dimsWithoutQuestions.length === 0 &&
      orphanQuestions.length === 0 &&
      publishedVersions.length > 0

    return {
      healthy,
      activeDimsCount: activeDims.length,
      activeQsCount: activeQs.length,
      totalWeight,
      weightOk,
      dimsWithoutQuestions,
      orphanQuestions,
      latestPublished,
      duplicateIds,
    }
  }, [dimensions, questions, versions, results, dimMap])

  const dateStamp = () => new Date().toISOString().slice(0, 10)

  // ── CSV EXPORTERS ───────────────────────────────────────────────────────────

  function exportDimensionsCsv() {
    const headers = [
      'dataset_table',
      'dimension_id',
      'sort_order',
      'name',
      'short_name',
      'weight',
      'is_active',
      'description',
      'strength_guidance',
      'development_guidance',
    ]
    const rows = dimensions.map((d) => [
      'dimensions',
      d.id,
      d.sort_order,
      d.name,
      d.short_name ?? '',
      d.weight,
      d.is_active ? 'true' : 'false',
      d.description ?? '',
      d.strength_guidance ?? '',
      d.development_guidance ?? '',
    ])
    downloadBlob(
      buildCsvString(headers, rows),
      `aha-dataset-dimensi-${dateStamp()}.csv`,
      'text/csv;charset=utf-8'
    )
    recordBackupLog('Dataset Dimensi & Bobot', 'CSV', rows.length)
    setNotice(`Berhasil mengunduh CSV Dataset Dimensi (${rows.length} baris).`)
  }

  function exportQuestionsCsv() {
    const headers = [
      'dataset_table',
      'question_id',
      'sort_order',
      'dimension_id',
      'dimension_name',
      'question_text',
      'weight',
      'reverse_scoring',
      'is_active',
    ]
    const rows = questions.map((q) => [
      'questions',
      q.id,
      q.sort_order,
      q.dimension_id,
      dimMap[q.dimension_id]?.name ?? '',
      q.question_text,
      q.weight,
      q.reverse_scoring ? 'true' : 'false',
      q.is_active ? 'true' : 'false',
    ])
    downloadBlob(
      buildCsvString(headers, rows),
      `aha-dataset-pertanyaan-${dateStamp()}.csv`,
      'text/csv;charset=utf-8'
    )
    recordBackupLog('Dataset Pertanyaan Asesmen', 'CSV', rows.length)
    setNotice(`Berhasil mengunduh CSV Dataset Pertanyaan (${rows.length} baris).`)
  }

  function exportVersionsCsv() {
    const headers = [
      'dataset_table',
      'version_id',
      'version_number',
      'status',
      'created_at',
      'published_at',
      'dimensions_count',
      'questions_count',
      'total_weight',
      'configuration_snapshot_json',
    ]
    const rows = versions.map((v) => {
      const snap = v.configuration_snapshot ?? {}
      const sDims = snap.dimensions ?? []
      const sQs = snap.questions ?? []
      const tWeight = sDims.reduce((s, d) => s + Number(d.weight || 0), 0)
      return [
        'assessment_versions',
        v.id,
        v.version_number,
        v.status,
        v.created_at ?? '',
        v.published_at ?? '',
        sDims.length,
        sQs.length,
        tWeight,
        JSON.stringify(snap),
      ]
    })
    downloadBlob(
      buildCsvString(headers, rows),
      `aha-dataset-versi-${dateStamp()}.csv`,
      'text/csv;charset=utf-8'
    )
    recordBackupLog('Dataset Snapshot Versi Asesmen', 'CSV', rows.length)
    setNotice(`Berhasil mengunduh CSV Dataset Versi Asesmen (${rows.length} baris).`)
  }

  function exportResultsSummaryCsv() {
    const headers = [
      'dataset_table',
      'result_id',
      'participant_name',
      'participant_email',
      'assessment_date',
      'overall_score',
      'category',
      'version_number',
    ]
    const rows = results.map((r) => [
      'results_summary',
      r.result_id,
      r.participant_name,
      r.participant_email ?? '',
      r.assessment_date,
      r.overall_score,
      r.category,
      r.version_number,
    ])
    downloadBlob(
      buildCsvString(headers, rows),
      `aha-dataset-hasil-peserta-${dateStamp()}.csv`,
      'text/csv;charset=utf-8'
    )
    recordBackupLog('Dataset Ringkasan Hasil Peserta', 'CSV', rows.length)
    setNotice(`Berhasil mengunduh CSV Hasil Peserta (${rows.length} baris).`)
  }

  async function fetchAllResultDetailsWithProgress() {
    const details = []
    const total = results.length
    setProgress({ current: 0, total })
    const batchSize = 5

    for (let i = 0; i < total; i += batchSize) {
      const slice = results.slice(i, i + batchSize)
      const chunkDetails = await Promise.all(
        slice.map((r) => fetchResultDetail(r.result_id).catch(() => null))
      )
      for (const d of chunkDetails) {
        if (d) details.push(d)
      }
      setProgress({ current: Math.min(total, i + slice.length), total })
    }
    return details
  }

  async function exportAllResponsesCsv() {
    setBusyLabel('Mengambil seluruh rincian jawaban peserta…')
    setError('')
    setNotice('')
    try {
      const details = await fetchAllResultDetailsWithProgress()
      const headers = [
        'dataset_table',
        'result_id',
        'participant_name',
        'participant_email',
        'completed_at',
        'version_number',
        'overall_score',
        'overall_category',
        'question_order',
        'dimension_name',
        'question_text',
        'question_weight',
        'reverse_scoring',
        'raw_answer_1_to_5',
        'answer_label',
        'corrected_answer_1_to_5',
        'normalized_item_score_0_100',
      ]
      const rows = []
      for (const det of details) {
        const res = det.result ?? {}
        const cfgDims = res.config?.dimensions ?? []
        const findDim = (id) =>
          cfgDims.find((d) => d.id === id)?.name ?? dimMap[id]?.name ?? ''
        const responses = det.responses ?? []
        responses.forEach((resp, idx) => {
          const q = resp.question ?? {}
          const itemScore = (((Number(resp.corrected_answer || 1) - 1) / 4) * 100).toFixed(2)
          rows.push([
            'participant_responses',
            res.id ?? det.participant?.id ?? '',
            res.participant_name ?? det.participant?.name ?? '',
            det.participant?.email ?? '',
            res.completed_at ?? '',
            det.version?.version_number ?? res.version_number ?? '',
            res.overall_score ?? '',
            res.category ?? '',
            idx + 1,
            findDim(q.dimension_id),
            q.text ?? '',
            q.weight ?? '',
            q.reverse_scoring ? 'true' : 'false',
            resp.answer,
            SCALE_LABELS[(resp.answer ?? 1) - 1] ?? '',
            resp.corrected_answer,
            itemScore,
          ])
        })
      }

      downloadBlob(
        buildCsvString(headers, rows),
        `aha-dataset-jawaban-lengkap-${dateStamp()}.csv`,
        'text/csv;charset=utf-8'
      )
      recordBackupLog('Dataset Rincian Jawaban Per Butir Pertanyaan', 'CSV', rows.length)
      setNotice(`Berhasil mengunduh CSV Rincian Jawaban Peserta (${rows.length} baris jawaban).`)
    } catch (err) {
      setError(err.message || 'Gagal mengekspor rincian jawaban peserta.')
    } finally {
      setBusyLabel('')
      setProgress({ current: 0, total: 0 })
    }
  }

  // BACKUP UTAMA HASIL ASESMEN PESERTA (1 baris = 1 peserta lengkap dengan 7 skor dimensi, Top 3 Strengths, Priorities, 21-Day Action Plan, & seluruh jawaban Q1..Qn)
  async function exportCompleteParticipantAssessmentBackupCsv() {
    setBusyLabel('Menyiapkan Backup Lengkap Hasil Asesmen Peserta (CSV)…')
    setError('')
    setNotice('')
    try {
      const details = await fetchAllResultDetailsWithProgress()
      const maxQuestions = Math.max(
        questions.length,
        ...details.map((d) => (d.responses ?? []).length),
        0
      )

      const dimHeaders = []
      dimensions.forEach((d, idx) => {
        const label = d.short_name || d.name || `Dim_${idx + 1}`
        dimHeaders.push(`dim_${idx + 1}_${label}_score`, `dim_${idx + 1}_${label}_category`)
      })

      const qHeaders = []
      for (let i = 1; i <= maxQuestions; i++) {
        qHeaders.push(`Q${i}_question`, `Q${i}_raw_1_5`, `Q${i}_corrected_1_5`, `Q${i}_score_0_100`)
      }

      const headers = [
        'result_id',
        'participant_id',
        'participant_name',
        'participant_email',
        'completed_at_iso',
        'completed_at_readable',
        'version_number',
        'overall_leadership_index',
        'overall_category',
        'overall_narrative',
        ...dimHeaders,
        'top_1_strength',
        'top_2_strength',
        'top_3_strength',
        'priority_1_development',
        'priority_2_development',
        'priority_3_development',
        'action_plan_days_1_7',
        'action_plan_days_8_14',
        'action_plan_days_15_21',
        ...qHeaders,
        'raw_dimension_scores_json',
        'raw_responses_json',
      ]

      const rows = details.map((det) => {
        const res = det.result ?? {}
        const rep = buildReport(res)
        const dimScores = res.dimension_scores ?? []

        const dimCells = []
        dimensions.forEach((d) => {
          const found =
            dimScores.find((ds) => ds.id === d.id || ds.dimension_id === d.id || ds.name === d.name) ??
            {}
          dimCells.push(found.score ?? '', found.category ?? '')
        })

        const strengths = rep?.strengths ?? []
        const priorities = rep?.priorities ?? []
        const plan = rep?.plan ?? []

        const formatInsight = (item) =>
          item ? `${item.name} (${fmt(item.score)}) — ${item.strength_guidance || item.development_guidance || ''}` : ''
        const formatPhase = (phase) =>
          phase ? `${phase.title} (${phase.focus}): ${(phase.actions ?? []).join(' | ')}` : ''

        const responses = det.responses ?? []
        const qCells = []
        for (let i = 0; i < maxQuestions; i++) {
          const r = responses[i]
          if (r) {
            const itemScore = (((Number(r.corrected_answer || 1) - 1) / 4) * 100).toFixed(2)
            qCells.push(
              r.question?.text ?? '',
              r.answer ?? '',
              r.corrected_answer ?? '',
              itemScore
            )
          } else {
            qCells.push('', '', '', '')
          }
        }

        return [
          res.id ?? '',
          det.participant?.id ?? '',
          res.participant_name ?? det.participant?.name ?? '',
          det.participant?.email ?? '',
          res.completed_at ?? '',
          dtfmt(res.completed_at),
          det.version?.version_number ?? res.version_number ?? '',
          res.overall_score ?? '',
          rep?.category?.name ?? res.category ?? '',
          rep?.category?.mean ?? '',
          ...dimCells,
          formatInsight(strengths[0]),
          formatInsight(strengths[1]),
          formatInsight(strengths[2]),
          formatInsight(priorities[0]),
          formatInsight(priorities[1]),
          formatInsight(priorities[2]),
          formatPhase(plan[0]),
          formatPhase(plan[1]),
          formatPhase(plan[2]),
          ...qCells,
          JSON.stringify(dimScores),
          JSON.stringify(responses),
        ]
      })

      downloadBlob(
        buildCsvString(headers, rows),
        `aha-backup-lengkap-hasil-asesmen-peserta-${dateStamp()}.csv`,
        'text/csv;charset=utf-8'
      )
      recordBackupLog('Backup Lengkap Hasil Asesmen Peserta (Skor Dimensi + Insight + Jawaban)', 'CSV', rows.length)
      setNotice(
        `Backup Lengkap Hasil Asesmen Peserta berhasil diunduh (${rows.length} peserta lengkap dengan skor 7 dimensi, Top 3 Strengths, Priorities, Action Plan, dan seluruh jawaban).`
      )
    } catch (err) {
      setError(err.message || 'Gagal menyiapkan backup lengkap hasil asesmen peserta.')
    } finally {
      setBusyLabel('')
      setProgress({ current: 0, total: 0 })
    }
  }

  // MASTER FULL DATASET CSV BACKUP (1 unified CSV covering ALL tables & participant responses!)
  async function exportFullMasterDatasetCsv() {
    setBusyLabel('Menyiapkan Full Master Dataset Backup (CSV)…')
    setError('')
    setNotice('')
    try {
      const details = await fetchAllResultDetailsWithProgress()
      const headers = [
        'dataset_section',
        'record_id',
        'parent_id',
        'sort_or_version',
        'status_or_active',
        'name_or_participant',
        'email_or_short_name',
        'dimension_name',
        'text_or_description',
        'weight_or_score',
        'category_or_label',
        'reverse_scoring',
        'raw_answer',
        'corrected_answer',
        'timestamp',
        'extra_guidance_or_json',
      ]

      const rows = []

      // 1. Dimensions
      for (const d of dimensions) {
        rows.push([
          '1_DIMENSIONS',
          d.id,
          '',
          d.sort_order,
          d.is_active ? 'active' : 'inactive',
          d.name,
          d.short_name ?? '',
          d.name,
          d.description ?? '',
          d.weight,
          '',
          '',
          '',
          '',
          '',
          JSON.stringify({
            strength_guidance: d.strength_guidance ?? '',
            development_guidance: d.development_guidance ?? '',
          }),
        ])
      }

      // 2. Questions
      for (const q of questions) {
        rows.push([
          '2_QUESTIONS',
          q.id,
          q.dimension_id,
          q.sort_order,
          q.is_active ? 'active' : 'inactive',
          `Pertanyaan #${q.sort_order}`,
          '',
          dimMap[q.dimension_id]?.name ?? '',
          q.question_text,
          q.weight,
          '',
          q.reverse_scoring ? 'true' : 'false',
          '',
          '',
          '',
          '',
        ])
      }

      // 3. Assessment Versions
      for (const v of versions) {
        const snap = v.configuration_snapshot ?? {}
        rows.push([
          '3_ASSESSMENT_VERSIONS',
          v.id,
          '',
          `v${v.version_number}`,
          v.status,
          `Snapshot Versi ${v.version_number}`,
          '',
          '',
          `Dimensi: ${(snap.dimensions ?? []).length}, Pertanyaan: ${(snap.questions ?? []).length}`,
          '',
          v.status,
          '',
          '',
          '',
          v.published_at || v.created_at || '',
          JSON.stringify(snap),
        ])
      }

      // 4. Participant Results Summary
      for (const r of results) {
        rows.push([
          '4_PARTICIPANT_RESULTS',
          r.result_id,
          '',
          `v${r.version_number}`,
          'completed',
          r.participant_name,
          r.participant_email ?? '',
          'Overall Leadership Index',
          '',
          r.overall_score,
          r.category,
          '',
          '',
          '',
          r.assessment_date,
          '',
        ])
      }

      // 5. Participant Granular Answers + Dimension Scores
      for (const det of details) {
        const res = det.result ?? {}
        const pName = res.participant_name ?? det.participant?.name ?? ''
        const pEmail = det.participant?.email ?? ''
        const vNum = det.version?.version_number ?? res.version_number ?? ''
        const cfgDims = res.config?.dimensions ?? []
        const findDim = (id) =>
          cfgDims.find((d) => d.id === id)?.name ?? dimMap[id]?.name ?? ''

        // Dimension scores per participant
        const dimScores = res.dimension_scores ?? []
        for (const ds of dimScores) {
          rows.push([
            '5_PARTICIPANT_DIMENSION_SCORES',
            `${res.id}_${ds.dimension_id || ds.name}`,
            res.id ?? '',
            `v${vNum}`,
            'scored',
            pName,
            pEmail,
            ds.name || findDim(ds.dimension_id),
            '',
            ds.score ?? '',
            ds.category ?? '',
            '',
            '',
            '',
            res.completed_at ?? '',
            '',
          ])
        }

        // Individual question answers per participant
        const responses = det.responses ?? []
        responses.forEach((resp, idx) => {
          const q = resp.question ?? {}
          const itemScore = (((Number(resp.corrected_answer || 1) - 1) / 4) * 100).toFixed(2)
          rows.push([
            '6_PARTICIPANT_ANSWERS',
            `${res.id}_Q${idx + 1}`,
            res.id ?? '',
            idx + 1,
            'answered',
            pName,
            pEmail,
            findDim(q.dimension_id),
            q.text ?? '',
            itemScore,
            SCALE_LABELS[(resp.answer ?? 1) - 1] ?? '',
            q.reverse_scoring ? 'true' : 'false',
            resp.answer,
            resp.corrected_answer,
            res.completed_at ?? '',
            '',
          ])
        })

        // Computed Report Insights (Top 3 Strengths, Priorities, 21-Day Action Plan)
        const rep = buildReport(res)
        if (rep) {
          rows.push([
            '7_PARTICIPANT_REPORT_INSIGHTS',
            `${res.id}_REPORT`,
            res.id ?? '',
            `v${vNum}`,
            'report',
            pName,
            pEmail,
            'Laporan & Action Plan 21 Hari',
            rep.category?.mean ?? '',
            rep.overall ?? '',
            rep.category?.name ?? '',
            '',
            '',
            '',
            res.completed_at ?? '',
            JSON.stringify({
              strengths: rep.strengths,
              priorities: rep.priorities,
              plan_21_days: rep.plan,
            }),
          ])
        }
      }

      // 8. Raw Database Tables (profiles, participants, assessment_sessions)
      for (const prof of rawDbTables.profiles ?? []) {
        rows.push([
          '8_ADMIN_PROFILES',
          prof.id ?? '',
          '',
          prof.role ?? 'admin',
          prof.is_active ? 'active' : 'inactive',
          prof.email ?? '',
          prof.role ?? '',
          '',
          'Profil Akun Admin',
          '',
          prof.role ?? '',
          '',
          '',
          '',
          prof.created_at ?? '',
          JSON.stringify(prof),
        ])
      }

      for (const part of rawDbTables.participants ?? []) {
        rows.push([
          '9_RAW_PARTICIPANTS_TABLE',
          part.id ?? '',
          '',
          '',
          'registered',
          part.name ?? part.full_name ?? '',
          part.email ?? '',
          '',
          'Data Tabel Participants',
          '',
          '',
          '',
          '',
          '',
          part.created_at ?? '',
          JSON.stringify(part),
        ])
      }

      for (const sess of rawDbTables.assessment_sessions ?? []) {
        rows.push([
          '10_ASSESSMENT_SESSIONS_TABLE',
          sess.id ?? '',
          sess.participant_id ?? '',
          sess.version_id ?? '',
          sess.status ?? (sess.completed_at ? 'completed' : 'started'),
          sess.participant_name ?? '',
          sess.participant_email ?? '',
          '',
          'Sesi Pengerjaan Asesmen',
          '',
          '',
          '',
          '',
          '',
          sess.completed_at || sess.started_at || sess.created_at || '',
          JSON.stringify(sess),
        ])
      }

      downloadBlob(
        buildCsvString(headers, rows),
        `aha-full-master-backup-${dateStamp()}.csv`,
        'text/csv;charset=utf-8'
      )
      recordBackupLog('Full Master Database Backup (Seluruh Tabel DB & Hasil Peserta)', 'CSV', rows.length)
      setNotice(
        `Full Master Database Backup CSV berhasil diunduh (${rows.length} total baris dari seluruh tabel database).`
      )
    } catch (err) {
      setError(err.message || 'Gagal menyiapkan Full Master Backup CSV.')
    } finally {
      setBusyLabel('')
      setProgress({ current: 0, total: 0 })
    }
  }

  async function exportFullJsonBundle() {
    setBusyLabel('Menyiapkan Full System Snapshot (.JSON)…')
    setError('')
    setNotice('')
    try {
      const details = await fetchAllResultDetailsWithProgress()
      const payload = {
        meta: {
          application: 'AHA Leadership Insight',
          exported_at: new Date().toISOString(),
          counts: {
            dimensions: dimensions.length,
            questions: questions.length,
            versions: versions.length,
            results: results.length,
            detailed_results: details.length,
            profiles: (rawDbTables.profiles ?? []).length,
            participants: (rawDbTables.participants ?? []).length,
            assessment_sessions: (rawDbTables.assessment_sessions ?? []).length,
          },
        },
        dimensions,
        questions,
        assessment_versions: versions,
        results_summary: results,
        results_detailed: details,
        raw_tables: rawDbTables,
      }
      const jsonStr = JSON.stringify(payload, null, 2)
      downloadBlob(
        jsonStr,
        `aha-full-snapshot-${dateStamp()}.json`,
        'application/json;charset=utf-8'
      )
      const totalItems =
        dimensions.length + questions.length + versions.length + details.length
      recordBackupLog('Full System Snapshot Bundle', 'JSON', totalItems)
      setNotice('Full System Snapshot (.JSON) berhasil diunduh.')
    } catch (err) {
      setError(err.message || 'Gagal mengekspor Full JSON Snapshot.')
    } finally {
      setBusyLabel('')
      setProgress({ current: 0, total: 0 })
    }
  }

  // ── RESTORE & IMPORT HANDLERS (Supports JSON or CSV!) ──────────────────────

  function handleFileUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setNotice('')

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = String(e.target?.result ?? '')
        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(content)
          const nextDims = parsed.dimensions ?? parsed.configuration_snapshot?.dimensions ?? []
          const nextQs = parsed.questions ?? parsed.configuration_snapshot?.questions ?? []
          if (!Array.isArray(nextDims) || !nextDims.length) {
            throw new Error('File JSON tidak berisi array "dimensions" yang valid.')
          }
          buildRestorePreview(file.name, 'JSON', nextDims, nextQs)
        } else if (file.name.toLowerCase().endsWith('.csv')) {
          const { items } = parseCsvText(content)
          if (!items.length) throw new Error('File CSV kosong atau tidak terbaca.')

          // Check if it's a Full Master Backup CSV, Dimensions CSV, or Questions CSV
          const masterDims = items.filter((r) => r.dataset_section === '1_DIMENSIONS')
          const masterQs = items.filter((r) => r.dataset_section === '2_QUESTIONS')

          if (masterDims.length > 0) {
            const parsedDims = masterDims.map((r) => {
              let extra = {}
              try {
                extra = JSON.parse(r.extra_guidance_or_json || '{}')
              } catch {
                extra = {}
              }
              return {
                id: r.record_id,
                sort_order: Number(r.sort_or_version || 1),
                name: r.name_or_participant,
                short_name: r.email_or_short_name,
                description: r.text_or_description,
                weight: Number(r.weight_or_score || 0),
                is_active: r.status_or_active === 'active',
                strength_guidance: extra.strength_guidance ?? '',
                development_guidance: extra.development_guidance ?? '',
              }
            })
            const parsedQs = masterQs.map((r) => ({
              id: r.record_id,
              dimension_id: r.parent_id,
              sort_order: Number(r.sort_or_version || 1),
              question_text: r.text_or_description,
              weight: Number(r.weight_or_score || 1),
              reverse_scoring: r.reverse_scoring === 'true',
              is_active: r.status_or_active === 'active',
            }))
            buildRestorePreview(file.name, 'Master CSV', parsedDims, parsedQs)
          } else if (items[0].dataset_table === 'dimensions' || items[0].dimension_id) {
            const parsedDims = items.map((r) => ({
              id: r.dimension_id || r.id,
              sort_order: Number(r.sort_order || 1),
              name: r.name,
              short_name: r.short_name,
              weight: Number(r.weight || 0),
              is_active: String(r.is_active).toLowerCase() === 'true',
              description: r.description ?? '',
              strength_guidance: r.strength_guidance ?? '',
              development_guidance: r.development_guidance ?? '',
            }))
            buildRestorePreview(file.name, 'CSV Dimensi', parsedDims, questions)
          } else if (items[0].dataset_table === 'questions' || items[0].question_id) {
            const parsedQs = items.map((r) => ({
              id: r.question_id || r.id,
              sort_order: Number(r.sort_order || 1),
              dimension_id: r.dimension_id,
              question_text: r.question_text,
              weight: Number(r.weight || 1),
              reverse_scoring: String(r.reverse_scoring).toLowerCase() === 'true',
              is_active: String(r.is_active).toLowerCase() === 'true',
            }))
            buildRestorePreview(file.name, 'CSV Pertanyaan', dimensions, parsedQs)
          } else {
            throw new Error(
              'Format CSV tidak dikenali. Gunakan file CSV dari menu Backup Dataset AHA.'
            )
          }
        } else {
          throw new Error('Gunakan file dengan ekstensi .csv atau .json.')
        }
      } catch (err) {
        setError(err.message || 'Gagal membaca file backup.')
        setRestorePreview(null)
      }
    }
    reader.readAsText(file)
  }

  function buildRestorePreview(filename, format, nextDims, nextQs) {
    const activeWeight = nextDims
      .filter((d) => d.is_active)
      .reduce((s, d) => s + Number(d.weight || 0), 0)
    const weightValid = Math.abs(activeWeight - 100) < 0.01

    setRestorePreview({
      filename,
      format,
      dimensions: nextDims,
      questions: nextQs.length ? nextQs : questions,
      activeWeight,
      weightValid,
    })
  }

  async function applyRestoreToWorkingDraft() {
    if (!restorePreview) return
    setBusyLabel('Memulihkan konfigurasi ke Working Draft…')
    setError('')
    setNotice('')
    try {
      await saveConfiguration(restorePreview.dimensions, restorePreview.questions)
      const draft = await saveDraft()
      setNotice(
        `Konfigurasi dari "${restorePreview.filename}" berhasil dipulihkan dan disimpan sebagai Draft Versi ${draft.version_number}.`
      )
      setRestorePreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadAllData()
    } catch (err) {
      setError(err.message || 'Gagal menerapkan pemulihan konfigurasi.')
    } finally {
      setBusyLabel('')
    }
  }

  // ── CLEANUP & MAINTENANCE FILTERING ────────────────────────────────────────

  const filteredCleanupResults = useMemo(() => {
    const q = cleanSearch.trim().toLowerCase()
    return results.filter((r) => {
      if (cleanMode === 'duplicates' && !diagnostics.duplicateIds.has(r.result_id)) {
        return false
      }
      if (cleanMode === 'test') {
        const text = `${r.participant_name} ${r.participant_email || ''}`.toLowerCase()
        const isTest =
          text.includes('test') ||
          text.includes('coba') ||
          text.includes('dummy') ||
          text.includes('demo') ||
          text.includes('example')
        if (!isTest) return false
      }
      if (q) {
        const hay = `${r.participant_name} ${r.participant_email || ''} ${r.category}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [results, cleanSearch, cleanMode, diagnostics.duplicateIds])

  const cleanTotalPages = Math.max(1, Math.ceil(filteredCleanupResults.length / cleanPageSize))
  const safeCleanPage = Math.min(cleanPage, cleanTotalPages - 1)
  const pagedCleanup = filteredCleanupResults.slice(
    safeCleanPage * cleanPageSize,
    safeCleanPage * cleanPageSize + cleanPageSize
  )

  function toggleSelectRow(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  function toggleSelectAllPage() {
    const pageIds = pagedCleanup.map((r) => r.result_id)
    const allSelected = pageIds.every((id) => selectedIds.includes(id))
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  async function handleConfirmBulkDelete() {
    if (confirmWord.trim().toUpperCase() !== 'HAPUS') return
    setBusyLabel(`Menghapus ${selectedIds.length} data hasil asesmen…`)
    setError('')
    setNotice('')
    try {
      for (const id of selectedIds) {
        await deleteResultRecord(id)
      }
      setNotice(`Berhasil menghapus ${selectedIds.length} data hasil asesmen.`)
      setSelectedIds([])
      setConfirmDeleteModal(false)
      setConfirmWord('')
      await loadAllData()
    } catch (err) {
      setError(err.message)
      setConfirmDeleteModal(false)
    } finally {
      setBusyLabel('')
    }
  }

  if (loading) return <p className="meta">Memuat pusat pengelolaan data & backup…</p>

  return (
    <>
      <header className="rs-head">
        <div>
          <div className="dim-title-row">
            <h1>Kelola Data & Backup</h1>
            <span className={'badge ' + (diagnostics.healthy ? 'ok' : 'warn')}>
              {diagnostics.healthy ? '✓ Dataset Sehat' : 'Perlu Perhatian'}
            </span>
          </div>
          <p className="rs-sub">
            Unduh cadangan CSV untuk keseluruhan dataset (hasil peserta, rincian jawaban,
            pertanyaan, dimensi, dan histori versi), pulihkan konfigurasi, atau kelola pembersihan
            data.
          </p>
        </div>

        <div className="dim-top-actions">
          <button
            type="button"
            className="rs-export rs-export-excel"
            onClick={exportCompleteParticipantAssessmentBackupCsv}
            disabled={Boolean(busyLabel)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Backup Hasil Peserta (CSV)</span>
          </button>
          <button
            type="button"
            className="rs-export"
            onClick={exportFullMasterDatasetCsv}
            disabled={Boolean(busyLabel)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Full Database (CSV)</span>
          </button>
          <button
            type="button"
            className="dim-btn-outline"
            onClick={exportFullJsonBundle}
            disabled={Boolean(busyLabel)}
          >
            Snapshot (.JSON)
          </button>
        </div>
      </header>

      {busyLabel && (
        <div className="dm-progress-banner" role="status" aria-live="polite">
          <div className="dm-progress-top">
            <strong>{busyLabel}</strong>
            {progress.total > 0 && (
              <span>
                {progress.current} / {progress.total} rekaman
              </span>
            )}
          </div>
          {progress.total > 0 && (
            <div className="dm-progress-track">
              <div
                className="dm-progress-fill"
                style={{
                  width: `${Math.round((progress.current / Math.max(1, progress.total)) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="alert">{error}</p>}
      {notice && <p className="alert success">{notice}</p>}

      {/* Top Dataset Summary Cards */}
      <section className="dm-stats-grid" aria-label="Ringkasan volume dataset">
        <div className="dm-stat-card">
          <span className="dm-stat-label">Hasil Peserta</span>
          <strong className="dm-stat-val">{results.length}</strong>
          <span className="dm-stat-meta">
            Estimasi ~{results.length * diagnostics.activeQsCount} baris jawaban
          </span>
        </div>
        <div className="dm-stat-card">
          <span className="dm-stat-label">Bank Pertanyaan</span>
          <strong className="dm-stat-val">{questions.length}</strong>
          <span className="dm-stat-meta">
            {diagnostics.activeQsCount} aktif · {questions.length - diagnostics.activeQsCount}{' '}
            nonaktif
          </span>
        </div>
        <div className="dm-stat-card">
          <span className="dm-stat-label">Dimensi Kepemimpinan</span>
          <strong className="dm-stat-val">{dimensions.length}</strong>
          <span className="dm-stat-meta">
            Total bobot aktif: <b>{fmt(diagnostics.totalWeight)}%</b>
          </span>
        </div>
        <div className="dm-stat-card">
          <span className="dm-stat-label">Snapshot Versi</span>
          <strong className="dm-stat-val">{versions.length}</strong>
          <span className="dm-stat-meta">
            {diagnostics.latestPublished
              ? `Aktif: v${diagnostics.latestPublished.version_number}`
              : 'Belum ada versi publikasi'}
          </span>
        </div>
      </section>

      {/* Sub-navigation Pill Tabs */}
      <div className="dm-subtabs" role="tablist" aria-label="Menu pengelolaan data">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'backup'}
          className={'dm-subtab' + (subTab === 'backup' ? ' active' : '')}
          onClick={() => setSubTab('backup')}
        >
          Backup & Ekspor CSV Dataset
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'restore'}
          className={'dm-subtab' + (subTab === 'restore' ? ' active' : '')}
          onClick={() => setSubTab('restore')}
        >
          Restore & Impor Konfigurasi
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'cleanup'}
          className={'dm-subtab' + (subTab === 'cleanup' ? ' active' : '')}
          onClick={() => setSubTab('cleanup')}
        >
          Pembersihan Data ({diagnostics.duplicateIds.size} duplikat)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'health'}
          className={'dm-subtab' + (subTab === 'health' ? ' active' : '')}
          onClick={() => setSubTab('health')}
        >
          Kesehatan & Integritas Data
        </button>
      </div>

      {/* TAB 1: BACKUP & EKSPOR CSV DATASET */}
      {subTab === 'backup' && (
        <div className="dm-section-stack">
          {/* Hero Primary Participant Assessment Backup Card */}
          <section className="dm-master-card">
            <div className="dm-master-info">
              <span className="dm-pill-tag">Backup Utama · Hasil Asesmen Peserta</span>
              <h2>Backup Lengkap Hasil Asesmen Peserta (.CSV)</h2>
              <p>
                Satu baris per peserta yang memuat <strong>100% data hasil asesmen</strong>: profil
                & timestamp peserta, <strong>Overall Leadership Index</strong>,{' '}
                <strong>skor & kategori ke-7 dimensi</strong>,{' '}
                <strong>Top 3 Strengths</strong>, <strong>3 Development Priorities</strong>,{' '}
                <strong>21-Day Action Plan (Hari 1–21)</strong>, serta{' '}
                <strong>seluruh jawaban per butir soal (Q1–Qn)</strong> dalam satu lembar CSV siap
                olah.
              </p>
            </div>
            <div className="dm-master-actions">
              <button
                type="button"
                className="rs-export rs-export-excel"
                onClick={exportCompleteParticipantAssessmentBackupCsv}
                disabled={Boolean(busyLabel)}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Backup Hasil Asesmen Peserta (CSV)</span>
              </button>
            </div>
          </section>

          {/* Hero Full Master Database Dump Card */}
          <section className="dm-master-card" style={{ background: '#f8fafc', borderColor: 'var(--mist)' }}>
            <div className="dm-master-info">
              <span className="dm-pill-tag" style={{ background: '#e2e8f0', color: 'var(--ink)' }}>
                Full Database Dump · Seluruh Tabel DB
              </span>
              <h2>Full Master Database Backup (.CSV)</h2>
              <p>
                Menggabungkan <strong>seluruh data yang tersimpan di database Supabase</strong> ke
                dalam satu file CSV terstruktur: <strong>1. Dimensi & Bobot</strong>,{' '}
                <strong>2. Bank Pertanyaan</strong>, <strong>3. Snapshot Versi Asesmen</strong>,{' '}
                <strong>4. Hasil Peserta</strong>, <strong>5. Skor per Dimensi</strong>,{' '}
                <strong>6. Jawaban Mentah & Terkoreksi</strong>,{' '}
                <strong>7. Laporan Insight & Action Plan</strong>, serta tabel sistem{' '}
                <strong>Profiles, Participants, & Assessment Sessions</strong>.
              </p>
            </div>
            <div className="dm-master-actions">
              <button
                type="button"
                className="rs-export"
                onClick={exportFullMasterDatasetCsv}
                disabled={Boolean(busyLabel)}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Unduh Full Database CSV</span>
              </button>
            </div>
          </section>

          {/* Individual Table CSV Backup Cards */}
          <section className="dm-grid-cards" aria-label="Backup CSV per tabel dataset">
            <div className="dm-card">
              <div className="dm-card-head">
                <span className="dm-card-badge">Tabel 1 · Hasil & Skor</span>
                <strong>CSV Ringkasan Hasil Peserta</strong>
              </div>
              <p>
                Berisi seluruh daftar peserta yang telah menyelesaikan asesmen ({results.length}{' '}
                peserta), tanggal asesmen, skor Overall Leadership Index, kategori, dan versi.
              </p>
              <button
                type="button"
                className="dim-btn-outline"
                onClick={exportResultsSummaryCsv}
                disabled={Boolean(busyLabel)}
              >
                Unduh CSV Hasil ({results.length} baris)
              </button>
            </div>

            <div className="dm-card">
              <div className="dm-card-head">
                <span className="dm-card-badge">Tabel 2 · Granular Item</span>
                <strong>CSV Rincian Jawaban per Pertanyaan</strong>
              </div>
              <p>
                Dataset paling detail untuk olah data statistik: mengekspor setiap jawaban mentah
                (skala 1–5), skor terkoreksi reverse, dan skor normalisasi (0–100) dari seluruh
                peserta.
              </p>
              <button
                type="button"
                className="dim-btn-outline"
                onClick={exportAllResponsesCsv}
                disabled={Boolean(busyLabel)}
              >
                Unduh CSV Semua Jawaban
              </button>
            </div>

            <div className="dm-card">
              <div className="dm-card-head">
                <span className="dm-card-badge">Tabel 3 · Konfigurasi</span>
                <strong>CSV Dataset Dimensi & Panduan</strong>
              </div>
              <p>
                Mencakup {dimensions.length} dimensi kepemimpinan beserta label singkat radar,
                persentase bobot, deskripsi, panduan kekuatan (strength), dan prioritas
                pengembangan.
              </p>
              <button
                type="button"
                className="dim-btn-outline"
                onClick={exportDimensionsCsv}
                disabled={Boolean(busyLabel)}
              >
                Unduh CSV Dimensi ({dimensions.length} baris)
              </button>
            </div>

            <div className="dm-card">
              <div className="dm-card-head">
                <span className="dm-card-badge">Tabel 4 · Instrumen</span>
                <strong>CSV Bank Pertanyaan Asesmen</strong>
              </div>
              <p>
                Mencakup {questions.length} butir pertanyaan aktif maupun nonaktif, relasi dimensi,
                urutan tampil, bobot pertanyaan, dan penanda <em>reverse scoring</em>.
              </p>
              <button
                type="button"
                className="dim-btn-outline"
                onClick={exportQuestionsCsv}
                disabled={Boolean(busyLabel)}
              >
                Unduh CSV Pertanyaan ({questions.length} baris)
              </button>
            </div>

            <div className="dm-card">
              <div className="dm-card-head">
                <span className="dm-card-badge">Tabel 5 · Audit Histori</span>
                <strong>CSV Riwayat Snapshot Versi</strong>
              </div>
              <p>
                Mencakup {versions.length} versi konfigurasi asesmen (Draft, Published, Archived)
                lengkap dengan tanggal rilis dan payload JSON snapshot konfigurasi.
              </p>
              <button
                type="button"
                className="dim-btn-outline"
                onClick={exportVersionsCsv}
                disabled={Boolean(busyLabel)}
              >
                Unduh CSV Versi ({versions.length} baris)
              </button>
            </div>

            <div className="dm-card">
              <div className="dm-card-head">
                <span className="dm-card-badge">Bundel JSON</span>
                <strong>Full System Snapshot (.JSON)</strong>
              </div>
              <p>
                Format objek terstruktur untuk kebutuhan arsip teknis atau pemulihan cepat
                konfigurasi dimensi & pertanyaan melalui tab Restore.
              </p>
              <button
                type="button"
                className="dim-btn-outline"
                onClick={exportFullJsonBundle}
                disabled={Boolean(busyLabel)}
              >
                Unduh Snapshot (.JSON)
              </button>
            </div>
          </section>

          {/* Local Backup Activity Log */}
          <section className="rs-card">
            <div className="dim-dt-head">
              <div>
                <h2>Riwayat Aktivitas Backup</h2>
                <p className="rs-sub">
                  Catatan unduhan backup dataset terakhir yang dilakukan dari perangkat ini.
                </p>
              </div>
            </div>
            <div className="rs-table-wrap">
              <table className="rs-table">
                <thead>
                  <tr>
                    <th>Waktu Backup</th>
                    <th>Jenis Dataset</th>
                    <th>Format</th>
                    <th className="rs-num">Jumlah Baris / Item</th>
                  </tr>
                </thead>
                <tbody>
                  {backupLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{dtfmt(log.timestamp)}</td>
                      <td>
                        <strong>{log.typeLabel}</strong>
                      </td>
                      <td>
                        <span className="rs-ver">{log.format}</span>
                      </td>
                      <td className="rs-num">{log.rowCount}</td>
                    </tr>
                  ))}
                  {!backupLogs.length && (
                    <tr>
                      <td colSpan="4" className="rs-empty">
                        Belum ada aktivitas backup pada sesi perangkat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: RESTORE & IMPOR KONFIGURASI */}
      {subTab === 'restore' && (
        <section className="rs-card dm-pad-card">
          <div className="dm-restore-intro">
            <h2>Restore Konfigurasi dari File Backup (.CSV / .JSON)</h2>
            <p className="rs-sub">
              Unggah file <strong>Full Master Backup (.CSV)</strong>,{' '}
              <strong>CSV Dimensi/Pertanyaan</strong>, atau{' '}
              <strong>Full System Snapshot (.JSON)</strong>. Sistem akan menampilkan pratinjau
              perubahan terlebih dahulu dan menyimpannya ke <em>Working Draft</em> tanpa merusak
              histori hasil peserta lama.
            </p>
          </div>

          <label className="dm-dropzone">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
            />
            <span className="dm-dropzone-icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </span>
            <strong>Pilih file backup (.CSV atau .JSON)</strong>
            <span>Klik untuk memilih file dari komputer Anda</span>
          </label>

          {restorePreview && (
            <div className="dm-preview-box">
              <div className="dm-preview-head">
                <div>
                  <span className="dm-pill-tag">{restorePreview.format}</span>
                  <h3>Pratinjau Pemulihan: {restorePreview.filename}</h3>
                  <p className="rs-sub">
                    Terdeteksi {restorePreview.dimensions.length} dimensi dan{' '}
                    {restorePreview.questions.length} pertanyaan · Total bobot aktif:{' '}
                    <strong>{fmt(restorePreview.activeWeight)}%</strong>
                  </p>
                </div>
                <div className="dim-top-actions">
                  <button
                    type="button"
                    className="dim-btn-outline"
                    onClick={() => {
                      setRestorePreview(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="dim-btn-primary"
                    disabled={!restorePreview.weightValid || Boolean(busyLabel)}
                    onClick={applyRestoreToWorkingDraft}
                  >
                    Pulihkan ke Working Draft
                  </button>
                </div>
              </div>

              {!restorePreview.weightValid && (
                <p className="alert">
                  Total bobot dimensi aktif pada file ini adalah{' '}
                  {fmt(restorePreview.activeWeight)}% (wajib tepat 100% sebelum dapat dipulihkan).
                </p>
              )}

              <div className="rs-table-wrap">
                <table className="rs-table">
                  <thead>
                    <tr>
                      <th>Dimensi pada File Backup</th>
                      <th>Label Radar</th>
                      <th className="rs-num">Bobot Baru</th>
                      <th className="rs-num">Bobot Saat Ini</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restorePreview.dimensions.map((d) => {
                      const current = dimMap[d.id]
                      return (
                        <tr key={d.id}>
                          <td>
                            <strong>{d.name}</strong>
                          </td>
                          <td>{d.short_name || '—'}</td>
                          <td className="rs-num">
                            <strong>{fmt(d.weight)}%</strong>
                          </td>
                          <td className="rs-num">{current ? `${fmt(current.weight)}%` : '—'}</td>
                          <td>
                            <span className={'rs-cat ' + (d.is_active ? 'rs-cat-strong' : 'rs-cat-low')}>
                              {d.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: PEMBERSIHAN DATA PESERTA */}
      {subTab === 'cleanup' && (
        <section className="rs-card" aria-label="Pembersihan data hasil peserta">
          <div className="dim-dt-head">
            <div>
              <h2>Pembersihan Data Hasil Peserta & Duplikat</h2>
              <p className="rs-sub">
                Gunakan filter di bawah untuk menemukan data uji coba (test/dummy) atau pengisian
                ganda di hari yang sama, lalu bersihkan dengan aman.
              </p>
            </div>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className="qm-btn-danger"
                onClick={() => {
                  setConfirmWord('')
                  setConfirmDeleteModal(true)
                }}
              >
                Hapus Terpilih ({selectedIds.length})
              </button>
            )}
          </div>

          <div className="rs-toolbar">
            <div className="rs-search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="search"
                placeholder="Cari nama atau email peserta…"
                value={cleanSearch}
                onChange={(e) => {
                  setCleanSearch(e.target.value)
                  setCleanPage(0)
                }}
              />
            </div>

            <CustomSelect
              ariaLabel="Filter mode pembersihan"
              value={cleanMode}
              onChange={(val) => {
                setCleanMode(val)
                setCleanPage(0)
              }}
              options={[
                { value: 'all', label: `Semua Hasil (${results.length})` },
                {
                  value: 'duplicates',
                  label: `Terindikasi Duplikat (${diagnostics.duplicateIds.size})`,
                },
                { value: 'test', label: 'Akun Uji Coba / Test / Dummy' },
              ]}
            />
          </div>

          <div className="rs-table-wrap">
            <table className="rs-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <input
                      type="checkbox"
                      aria-label="Pilih semua di halaman ini"
                      checked={
                        pagedCleanup.length > 0 &&
                        pagedCleanup.every((r) => selectedIds.includes(r.result_id))
                      }
                      onChange={toggleSelectAllPage}
                    />
                  </th>
                  <th>Peserta</th>
                  <th>Tanggal Asesmen</th>
                  <th className="rs-num">Skor Index</th>
                  <th>Kategori</th>
                  <th>Penanda</th>
                </tr>
              </thead>
              <tbody>
                {pagedCleanup.map((row) => {
                  const isDup = diagnostics.duplicateIds.has(row.result_id)
                  const isChecked = selectedIds.includes(row.result_id)
                  return (
                    <tr key={row.result_id} className={isChecked ? 'on' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${row.participant_name}`}
                          checked={isChecked}
                          onChange={() => toggleSelectRow(row.result_id)}
                        />
                      </td>
                      <td>
                        <div className="rs-person">
                          <span className="rs-avatar" aria-hidden="true">
                            {(row.participant_name || '?').trim().charAt(0).toUpperCase()}
                          </span>
                          <span className="rs-person-text">
                            <strong>{row.participant_name}</strong>
                            {row.participant_email && <small>{row.participant_email}</small>}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="rs-datetime">
                          <span className="rs-date-main">{dfmt(row.assessment_date)}</span>
                          {tfmt(row.assessment_date) && (
                            <span className="rs-time-sub">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              {tfmt(row.assessment_date)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="rs-num">
                        <strong>{fmt(row.overall_score)}</strong>
                      </td>
                      <td>
                        <span className="rs-cat rs-cat-mid">{row.category}</span>
                      </td>
                      <td>
                        {isDup ? (
                          <span className="rs-cat rs-cat-dev">Duplikat Hari Sama</span>
                        ) : (
                          <span className="rs-ver">Normal</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!pagedCleanup.length && (
                  <tr>
                    <td colSpan="6" className="rs-empty">
                      Tidak ada data peserta yang cocok dengan filter pembersihan ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rs-footer">
            <div className="rs-size">
              <span>Tampilkan</span>
              <CustomSelect
                className="cs-compact"
                ariaLabel="Jumlah baris per halaman"
                value={cleanPageSize}
                onChange={(val) => {
                  setCleanPageSize(Number(val))
                  setCleanPage(0)
                }}
                options={[10, 25, 50].map((s) => ({ value: s, label: String(s) }))}
              />
              <span>entri</span>
            </div>
            <span className="rs-info">
              Total cocok: {filteredCleanupResults.length} peserta
            </span>
            <nav className="rs-pager" aria-label="Paginasi pembersihan">
              <button
                type="button"
                className="rs-pg"
                disabled={safeCleanPage === 0}
                onClick={() => setCleanPage((p) => Math.max(0, p - 1))}
              >
                ‹
              </button>
              <span className="rs-pg-now">
                {safeCleanPage + 1} / {cleanTotalPages}
              </span>
              <button
                type="button"
                className="rs-pg"
                disabled={safeCleanPage >= cleanTotalPages - 1}
                onClick={() => setCleanPage((p) => Math.min(cleanTotalPages - 1, p + 1))}
              >
                ›
              </button>
            </nav>
          </div>
        </section>
      )}

      {/* TAB 4: KESEHATAN & INTEGRITAS DATA */}
      {subTab === 'health' && (
        <section className="rs-card dm-pad-card" aria-label="Audit integritas dataset">
          <h2>Diagnostik & Integritas Konfigurasi Database</h2>
          <p className="rs-sub" style={{ marginBottom: 18 }}>
            Pemeriksaan otomatis terhadap aturan bisnis, relasi antar tabel, dan kesiapan asesmen.
          </p>

          <div className="dm-health-list">
            <div className="dm-health-item">
              <span className={'dm-health-dot ' + (diagnostics.weightOk ? 'ok' : 'warn')} />
              <div>
                <strong>Validasi Total Bobot Dimensi Aktif (Wajib 100%)</strong>
                <p>
                  Total bobot saat ini: <b>{fmt(diagnostics.totalWeight)}%</b> dari{' '}
                  {diagnostics.activeDimsCount} dimensi aktif.
                </p>
              </div>
            </div>

            <div className="dm-health-item">
              <span
                className={
                  'dm-health-dot ' +
                  (diagnostics.dimsWithoutQuestions.length === 0 ? 'ok' : 'warn')
                }
              />
              <div>
                <strong>Ketersediaan Pertanyaan Aktif per Dimensi</strong>
                <p>
                  {diagnostics.dimsWithoutQuestions.length === 0
                    ? 'Seluruh dimensi aktif memiliki minimal 1 pertanyaan aktif.'
                    : `Perhatian: Dimensi berikut belum memiliki pertanyaan aktif: ${diagnostics.dimsWithoutQuestions.map((d) => d.name).join(', ')}.`}
                </p>
              </div>
            </div>

            <div className="dm-health-item">
              <span
                className={
                  'dm-health-dot ' + (diagnostics.orphanQuestions.length === 0 ? 'ok' : 'warn')
                }
              />
              <div>
                <strong>Integritas Relasi Pertanyaan → Dimensi (Foreign Key)</strong>
                <p>
                  {diagnostics.orphanQuestions.length === 0
                    ? `Seluruh ${questions.length} pertanyaan terhubung ke ID dimensi yang valid.`
                    : `Ditemukan ${diagnostics.orphanQuestions.length} pertanyaan tanpa dimensi yang valid.`}
                </p>
              </div>
            </div>

            <div className="dm-health-item">
              <span
                className={'dm-health-dot ' + (diagnostics.latestPublished ? 'ok' : 'warn')}
              />
              <div>
                <strong>Status Snapshot Versi Publikasi Aktif</strong>
                <p>
                  {diagnostics.latestPublished
                    ? `Versi aktif saat ini adalah v${diagnostics.latestPublished.version_number} (dipublikasikan ${dtfmt(diagnostics.latestPublished.published_at)}).`
                    : 'Belum ada versi asesmen berstatus Published.'}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Protected Confirmation Modal for Bulk Deletion */}
      {confirmDeleteModal && (
        <div
          className="qm-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDeleteModal(false)
          }}
        >
          <div className="qm-modal" role="dialog" aria-modal="true" aria-labelledby="dm-del-title">
            <div className="qm-head">
              <div className="qm-head-left">
                <span className="qm-icon qm-icon-danger" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </span>
                <div>
                  <h2 id="dm-del-title">Hapus {selectedIds.length} Data Hasil Peserta?</h2>
                  <p>Tindakan ini permanen dan tidak dapat dibatalkan.</p>
                </div>
              </div>
              <button
                type="button"
                className="qm-close"
                onClick={() => setConfirmDeleteModal(false)}
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
            <div className="qm-body">
              <p className="rp-confirm-text">
                Disarankan untuk mengunduh <strong>Full Master Backup (CSV)</strong> terlebih dahulu
                sebelum menghapus data peserta. Ketik kata <strong>HAPUS</strong> di bawah ini untuk
                melanjutkan:
              </p>
              <div className="qm-field">
                <input
                  type="text"
                  placeholder="Ketik HAPUS"
                  value={confirmWord}
                  onChange={(e) => setConfirmWord(e.target.value)}
                />
              </div>
            </div>
            <div className="qm-foot">
              <button
                type="button"
                className="qm-btn-cancel"
                onClick={() => setConfirmDeleteModal(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="qm-btn-danger"
                disabled={confirmWord.trim().toUpperCase() !== 'HAPUS' || Boolean(busyLabel)}
                onClick={handleConfirmBulkDelete}
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
