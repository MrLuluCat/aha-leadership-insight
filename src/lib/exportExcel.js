import { fmt, dtfmt } from './format'

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function triggerDownload(htmlBody, filename) {
  const doc = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>AHA Leadership</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #061e55; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16pt; }
  th { background-color: #061e55; color: #ffffff; font-weight: bold; text-align: left; padding: 8pt 10pt; border: 1pt solid #cbd5e1; }
  td { padding: 7pt 10pt; border: 1pt solid #e2e8f0; vertical-align: top; }
  .num { text-align: right; mso-number-format:"0\\.0"; }
  .head-title { font-size: 15pt; font-weight: bold; color: #061e55; }
  .sub { color: #475569; font-size: 10pt; }
  .sum td { background-color: #eef4ff; font-weight: bold; }
  .sec { background-color: #f1f5f9; font-weight: bold; color: #061e55; }
</style>
</head>
<body>${htmlBody}</body></html>`

  const blob = new Blob([doc], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportResultsListExcel(rows) {
  const trs = rows
    .map(
      (r, idx) => `<tr>
      <td>${idx + 1}</td>
      <td><b>${esc(r.participant_name)}</b></td>
      <td>${esc(r.participant_email || '—')}</td>
      <td>${esc(dtfmt(r.assessment_date))}</td>
      <td class="num">${esc(fmt(r.overall_score))}</td>
      <td>${esc(r.category)}</td>
      <td>v${esc(r.version_number)}</td>
    </tr>`
    )
    .join('')

  const html = `
    <table>
      <tr><td colspan="7" class="head-title">Daftar Hasil Asesmen — AHA Leadership Insight</td></tr>
      <tr><td colspan="7" class="sub">Total data: ${rows.length} peserta</td></tr>
    </table>
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Nama Peserta</th>
          <th>Email</th>
          <th>Tanggal Asesmen</th>
          <th>Leadership Index</th>
          <th>Kategori</th>
          <th>Versi</th>
        </tr>
      </thead>
      <tbody>${trs}</tbody>
    </table>`

  triggerDownload(html, 'hasil-aha-leadership.xls')
}

export function exportParticipantReportExcel(report) {
  if (!report) return
  const { result, dimensions, overall, category, strengths, priorities, plan } = report
  const safeName = (result.participant_name || 'peserta')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const dimRows = dimensions
    .map(
      (d) => `<tr>
      <td>${esc(d.name)}</td>
      <td class="num">${esc(fmt(d.score))}</td>
      <td class="num">${esc(fmt(d.weight))}%</td>
      <td>${esc(d.category)}</td>
    </tr>`
    )
    .join('')

  const strengthRows = strengths
    .map(
      (d, i) => `<tr>
      <td>${i + 1}</td>
      <td><b>${esc(d.name)}</b> (${esc(fmt(d.score))})</td>
      <td colspan="2">${esc(d.strength_guidance)}</td>
    </tr>`
    )
    .join('')

  const priorityRows = priorities
    .map(
      (d, i) => `<tr>
      <td>${i + 1}</td>
      <td><b>${esc(d.name)}</b> (${esc(fmt(d.score))})</td>
      <td colspan="2">${esc(d.development_guidance)}</td>
    </tr>`
    )
    .join('')

  const planRows = plan
    .map(
      (p) => `<tr>
      <td><b>${esc(p.days)}</b></td>
      <td><b>${esc(p.title)}</b><br/><span class="sub">${esc(p.focus)}</span></td>
      <td colspan="2">${p.actions.map((act) => `• ${esc(act)}`).join('<br/>')}</td>
    </tr>`
    )
    .join('')

  const html = `
    <table>
      <tr><td colspan="4" class="head-title">Laporan Asesmen Kepemimpinan — ${esc(result.participant_name)}</td></tr>
      <tr><td colspan="4" class="sub">Tanggal: ${esc(dtfmt(result.completed_at))} · Versi konfigurasi ${esc(result.version_number)}</td></tr>
      <tr class="sum">
        <td>Skor Keseluruhan</td>
        <td class="num">${esc(fmt(overall))} / 100</td>
        <td>Kategori: ${esc(category?.name)}</td>
        <td>${esc(category?.mean)}</td>
      </tr>
    </table>

    <table>
      <thead>
        <tr>
          <th>Dimensi</th>
          <th>Skor</th>
          <th>Bobot</th>
          <th>Kategori</th>
        </tr>
      </thead>
      <tbody>
        ${dimRows}
        <tr class="sum">
          <td>Overall Leadership Index</td>
          <td class="num">${esc(fmt(overall))}</td>
          <td class="num">100%</td>
          <td>${esc(category?.name)}</td>
        </tr>
      </tbody>
    </table>

    <table>
      <thead><tr><th colspan="4">Top 3 Strengths</th></tr></thead>
      <tbody>${strengthRows}</tbody>
    </table>

    <table>
      <thead><tr><th colspan="4">Development Priorities</th></tr></thead>
      <tbody>${priorityRows}</tbody>
    </table>

    <table>
      <thead><tr><th colspan="4">21-Day Action Plan</th></tr></thead>
      <tbody>${planRows}</tbody>
    </table>`

  triggerDownload(html, `laporan-aha-${safeName || 'peserta'}.xls`)
}
