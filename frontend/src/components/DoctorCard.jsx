// The doctor card (CLINIC-028, client document Section 10 "Doctor Smart Summary"): one short
// screen instead of a paragraph. Data blocks (patient, main problem, vitals, checklist) come
// straight from the visit; AI blocks (today's status, relevant history, from reports) are the
// summary text read back by the server (summary_card). Each block says which it is. Below,
// tabs open the full answers (default), the summary text (with Edit), the report photos and
// the previous visits. A returning patient also gets the trends table (CLINIC-030). Mounted per patient (keyed by the page), so the tab starts on answers.
// All text is plain React text — never HTML.
import { useState } from 'react'
import PatientHeader from './PatientHeader'
import VitalsStrip from './VitalsStrip'
import QaList from './QaList'
import AiSummaryCard from './AiSummaryCard'
import ReportsList from './ReportsList'
import PreviousVisits from './PreviousVisits'
import TrendsTable from './TrendsTable'
import { formatDateTime, formatDay, SHORT_DAY } from '../utils/format'

const SOURCE_LABEL = { ai: 'AI', data: 'DATA', mix: 'DATA + AI-READ' }

function Block({ title, source, wide, children }) {
  return (
    <section className={`dc-block${source === 'ai' ? ' dc-block--ai' : ''}${wide ? ' dc-block--wide' : ''}`}>
      <div className="dc-head">
        <h3>{title}</h3>
        <span className={`dc-src dc-src--${source}`}>{SOURCE_LABEL[source]}</span>
      </div>
      {children}
    </section>
  )
}

// "- Label: value" lines; a line without a label shows its text alone.
function Lines({ items, empty }) {
  if (!items.length) return <p className="dc-empty">{empty}</p>
  return (
    <dl className="dc-kv">
      {items.map((it, i) => (
        <div key={i} className="dc-kv-row">
          {it.label ? <dt>{it.label}</dt> : null}
          <dd className={it.label ? '' : 'dc-kv-full'}>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function DoctorCard({
  visit, mobile, card, mainProblem, vitals, vitalsDisplay, qa, answered, summary, reports, previousVisits, trends,
  onSummarySave, onOpenVisit, actions,
}) {
  const [tab, setTab] = useState('answers')
  // Vitals entered as fields — or, on lists from before CLINIC-024 PR B, the summary's line
  // from the spoken vitals answer (its own "not recorded" counts as not recorded).
  const fieldVitals = vitalsDisplay.some((d) => d.value)
  const spokenVitals = !fieldVitals && card.vitals && !/not recorded/i.test(card.vitals) ? card.vitals : null
  const vitalsRecorded = fieldVitals || Boolean(spokenVitals)
  // Weight is taken at registration (CLINIC-023), shown with today's vitals when there is one.
  const display = visit.weight_kg != null
    ? [...vitalsDisplay, { label: 'Weight', value: `${Number(visit.weight_kg)} kg` }]
    : vitalsDisplay
  const historyDone = qa.length > 0 && answered === qa.length
  const tabs = [
    ['answers', `Full answers (${qa.length})`],
    ['summary', 'AI summary text'],
    ['reports', `Reports (${reports.length})`],
    ['previous', `Previous visits (${previousVisits.length})`],
  ]

  return (
    <>
      <div className="dc-grid">
        <Block title="Patient" source="data" wide>
          <PatientHeader visit={visit} mobile={mobile} />
          {mainProblem ? (
            <p className="dc-main">
              Main problem: <b>{mainProblem.choices.join(' + ')}</b>
              {mainProblem.details ? <span className="dc-muted"> — {mainProblem.details}</span> : null}
            </p>
          ) : null}
          {card.since ? <p className="dc-since">{card.since}</p> : null}
        </Block>

        <Block title="Today's status" source="ai">
          <Lines items={card.today} empty="Nothing listed — see the full answers." />
        </Block>

        <Block title="Relevant history" source="ai">
          <Lines items={card.history} empty="Nothing listed — see the full answers." />
          {previousVisits.length ? (
            <p className="dc-note">
              Previous visits: <b>{previousVisits.length}</b> (last {formatDay(previousVisits[0].visit_date, SHORT_DAY)})
            </p>
          ) : null}
        </Block>

        <Block title="Vitals" source="data">
          <VitalsStrip display={display} />
          {spokenVitals ? <p className="dc-main">{spokenVitals} <span className="dc-muted">(spoken answer)</span></p> : null}
          {!display.length && !spokenVitals ? <p className="dc-empty">Not recorded</p> : null}
          {fieldVitals && vitals?.recorded_at ? (
            <p className="dc-note">Recorded {formatDateTime(vitals.recorded_at)}</p>
          ) : null}
        </Block>

        <Block title="Attender checklist" source="data">
          <div className="dc-check">
            <div>Patient history <b className={historyDone ? 'dc-ok' : 'dc-miss'}>
              {historyDone ? 'Completed' : 'Incomplete'} {answered}/{qa.length}</b></div>
            <div>Vitals <b className={vitalsRecorded ? 'dc-ok' : 'dc-miss'}>{vitalsRecorded ? 'Recorded' : 'Not recorded'}</b></div>
            <div>Reports <b className={reports.length ? 'dc-ok' : 'dc-na'}>{reports.length ? `Uploaded (${reports.length})` : 'None'}</b></div>
          </div>
        </Block>

        {/* CLINIC-030: hidden for a new patient or when nothing was measured on 2 visits. */}
        {trends ? (
          <Block title={`Trends — last ${trends.visits.length} visits`} source={trends.rows.some((r) => r.source === 'reports') ? 'mix' : 'data'} wide>
            <TrendsTable trends={trends} onOpenVisit={onOpenVisit} />
          </Block>
        ) : null}

        {/* CLINIC-029: points for the doctor to check — never a diagnosis or treatment. Hidden
            for a summary without the block (made before it, or edited out): "Nothing flagged"
            would claim a check that was never made. */}
        {card.review ? (
          <Block title="AI suggestions — for doctor to confirm" source="ai" wide>
            {card.review.length ? (
              <ol className="dc-list">
                {card.review.map((l, i) => <li key={i}>{l}</li>)}
              </ol>
            ) : <p className="dc-empty">Nothing flagged.</p>}
          </Block>
        ) : null}

        {card.reports.length ? (
          <Block title="From reports" source="ai" wide>
            <ul className="dc-list">{card.reports.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </Block>
        ) : null}

        {/* Anything the AI wrote outside the blocks — never dropped. */}
        {card.other.length ? (
          <Block title="Also in the summary" source="ai" wide>
            <ul className="dc-list">{card.other.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </Block>
        ) : null}
      </div>

      {actions}

      <div className="dc-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={`dc-tab${tab === key ? ' dc-tab--on' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {/* All panels stay mounted (hidden when not chosen), so the report photos load once
          and an open summary edit isn't lost by switching tabs. */}
      <div className="dc-panel" hidden={tab !== 'answers'}><QaList qa={qa} /></div>
      <div className="dc-panel" hidden={tab !== 'summary'}>
        <AiSummaryCard summary={summary} status={visit.status} onSave={onSummarySave} />
      </div>
      <div className="dc-panel" hidden={tab !== 'reports'}>
        {reports.length ? <ReportsList reports={reports} /> : <p className="dc-empty">No report photos.</p>}
      </div>
      <div className="dc-panel" hidden={tab !== 'previous'}>
        {previousVisits.length
          ? <PreviousVisits visits={previousVisits} onOpen={onOpenVisit} />
          : <p className="dc-empty">No earlier visits for this patient.</p>}
      </div>
    </>
  )
}
