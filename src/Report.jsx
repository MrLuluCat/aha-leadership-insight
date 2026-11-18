import Radar from './Radar'
import logo from './assets/aha-logo.jpg'
import { buildReport } from './lib/report'
import { fmt, dfmt } from './lib/format'

export default function Report({ result, onRestart, compact = false }) {
  const report = buildReport(result)
  if (!report) return null

  const { dimensions, overall, category, strengths, priorities, plan } = report

  return (
    <article className={'report' + (compact ? ' compact' : '')}>
      <header className="report-head">
        <img className="logo sm" src={logo} alt="AHA Leadership Centre" />
        <p className="brand">Laporan asesmen</p>
        <h1>{result.participant_name}</h1>
        <p className="meta">
          Asesmen {dfmt(result.completed_at)} · Versi konfigurasi {result.version_number}
        </p>
        <p className="overall">
          <b>{fmt(overall)}</b>
          <span>dari 100 · {category?.name ?? '—'}</span>
        </p>
        <p className="lead">{category?.mean}</p>
      </header>

      <div className="rwrap">
        <Radar
          values={dimensions.map((d) => d.score / 100)}
          labels={dimensions.map((d) => d.short_name || d.name)}
        />
        <table className="recap">
          <thead>
            <tr>
              <th>Dimensi</th>
              <th>Skor</th>
              <th>Bobot</th>
              <th>Kategori</th>
            </tr>
          </thead>
          <tbody>
            {dimensions.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>
                  <b>{fmt(d.score)}</b>
                </td>
                <td>{fmt(d.weight)}%</td>
                <td>{d.category}</td>
              </tr>
            ))}
            <tr className="sum">
              <td>Overall Leadership Index</td>
              <td>
                <b>{fmt(overall)}</b>
              </td>
              <td>100%</td>
              <td>{category?.name}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="cols">
        <div>
          <h2>Top 3 Strengths</h2>
          <ul className="insight-list">
            {strengths.map((d) => (
              <li key={d.id}>
                <b>
                  {d.name} ({fmt(d.score)})
                </b>
                <p>{d.strength_guidance}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Development Priorities</h2>
          <ul className="insight-list">
            {priorities.map((d) => (
              <li key={d.id}>
                <b>
                  {d.name} ({fmt(d.score)})
                </b>
                <p>{d.development_guidance}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="plan">
        <h2>21-Day Action Plan</h2>
        <div className="phases">
          {plan.map((phase) => (
            <div className="phase" key={phase.days}>
              <p className="phase-days">{phase.days}</p>
              <h3>{phase.title}</h3>
              <p className="meta">{phase.focus}</p>
              <ul>
                {phase.actions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="note">
        Hasil mencerminkan jawaban reflektif peserta untuk pengembangan diri, bukan diagnosis psikologis
        atau dasar keputusan seleksi. Skor dihitung menggunakan konfigurasi versi yang tercatat pada sesi
        asesmen ini.
      </p>

      <div className="actions no-print">
        <button className="btn" onClick={() => window.print()}>
          Cetak / simpan PDF
        </button>
        {onRestart && (
          <button className="link" onClick={onRestart}>
            Ulangi asesmen
          </button>
        )}
      </div>
    </article>
  )
}
