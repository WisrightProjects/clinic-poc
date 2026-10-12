// Left rail: the patient queue grouped by visit date, newest day first, with a
// status chip per row. Selection is owned by the page and preserved across polls
// (AC3). Grouping is presentation-only — rows still carry the real visit id, so
// selection / stats / Done are unaffected. Tokens are per-day (they restart at 1
// each day), so grouping by date is what makes the repeated numbers make sense.
//
// Outlook-style: each day is a collapsible section. Today + Yesterday open by
// default; older days start collapsed behind a caret so the rail stays short.
import { useState } from 'react'
import StatusChip from './StatusChip'
import { TESTS_GROUP, groupKey, isInQueueOn } from '../utils/queue'

// Local calendar day as YYYY-MM-DD, so "Today"/"Yesterday" match the wall clock
// without a timezone shift.
function dayKey(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function todayKey() {
  return dayKey(new Date())
}
function yesterdayKey() {
  const d = new Date()
  d.setDate(d.getDate() - 1) // JS rolls month/year back correctly
  return dayKey(d)
}

// Bucket visits by queue group (see utils/queue.js): "Waiting for tests" first, then each
// queue day, newest first. Within a group, order by queue token so it reads 1, 2, 3…
function groupByDate(visits) {
  const buckets = new Map()
  for (const v of visits) {
    const key = groupKey(v)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(v)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === TESTS_GROUP || b === TESTS_GROUP) return a === TESTS_GROUP ? -1 : 1
      return a < b ? 1 : -1 // real dates newest first
    })
    .map(([date, items]) => ({
      date,
      items: [...items].sort((x, y) => x.queue_token - y.queue_token),
    }))
}

function formatDate(key) {
  if (key === 'unknown') return 'No date'
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d) // local construction — no tz shift
  return dt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Compact "25 Aug" — appended to Today/Yesterday so the actual calendar date is
// still visible (otherwise the relative label hides which day it resolves to).
function shortDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Intake progress for the answered/total badge. `idle` = nothing recorded,
// `done` = every template question answered, `live` = partway. Counts come from
// GET /visits (answered_count / total_questions).
function progress(v) {
  const answered = v.answered_count ?? 0
  const total = v.total_questions ?? 0
  const state = answered <= 0 ? 'idle' : answered >= total ? 'done' : 'live'
  // Fill reaches 100% only when actually complete; floor while partial so a
  // near-complete ratio (e.g. 199/200) can't fill the bar a question early.
  const pct = total <= 0 ? 0 : state === 'done' ? 100 : Math.min(99, Math.floor((answered / total) * 100))
  return { answered, total, pct, state }
}

// Token colour by workflow stage (manager request): completed = grey,
// ongoing (anywhere in the flow) = blue, upcoming (not started) = yellow.
// Unknown statuses fall through to the default navy badge.
function tokenState(status) {
  if (status === 'done') return 'done'
  if (status === 'waiting') return 'next'
  if (status === 'answering' || status === 'answered' || status === 'summarised') return 'current'
  return null
}

// Recent days read as "Today"/"Yesterday" (with the date kept alongside); older
// days keep their full date.
function groupLabel(key, today, yesterday) {
  if (key === TESTS_GROUP) return 'Waiting for tests'
  if (key === today) return `Today · ${shortDate(key)}`
  if (key === yesterday) return `Yesterday · ${shortDate(key)}`
  return formatDate(key)
}

export default function QueueRail({ user, visits, selectedId, onSelect, isLoading, error, onRetry }) {
  const groups = groupByDate(visits)
  const today = todayKey()
  const yesterday = yesterdayKey()

  // The count badge reflects TODAY's queue only — tokens reset daily, so an
  // all-days total isn't a meaningful "queue size". Older days still show in the
  // rail (collapsed); only the header number is scoped to today.
  const todayCount = visits.filter((v) => isInQueueOn(v, today)).length

  // A day is open by default if it's Today, Yesterday, or holds the selected
  // patient (the page auto-selects the first actionable visit, which may sit in
  // an older day — we keep that row visible). This is computed live each render,
  // so it stays correct across the 5s poll and a midnight boundary.
  const selected = visits.find((x) => x.id === selectedId)
  const selectedKey = selected ? groupKey(selected) : null
  const defaultOpen = (key) => key === TESTS_GROUP || key === today || key === yesterday || key === selectedKey

  // We track only the user's explicit toggles (key -> open?), layered over the
  // live defaults above. This keeps the caret functional on every day (incl. the
  // selected/today ones) without an effect, and survives the poll (re-render).
  const [userToggled, setUserToggled] = useState({})
  const isOpen = (key) => (key in userToggled ? userToggled[key] : defaultOpen(key))
  const toggle = (key) =>
    setUserToggled((prev) => {
      const currentlyOpen = key in prev ? prev[key] : defaultOpen(key)
      return { ...prev, [key]: !currentlyOpen }
    })

  return (
    <aside className="rail">
      <div className="rail-clinic">
        <div className="rail-clinic-name">{user?.clinic?.name}</div>
        <div className="rail-clinic-date">{formatDate(today)}</div>
        <div className="rail-clinic-doc">{user?.name}</div>
      </div>

      <div className="rail-head">
        <span className="rail-title">Today's Queue</span>
        <span className="rail-count">{todayCount}</span>
      </div>

      {isLoading ? (
        <div className="rail-msg">Loading queue…</div>
      ) : error && visits.length === 0 ? (
        <div className="rail-msg rail-msg--error">
          Could not load queue.
          <button className="link-btn" onClick={onRetry}>Retry</button>
        </div>
      ) : visits.length === 0 ? (
        <div className="rail-msg">No patients in the queue yet</div>
      ) : (
        <div className="rail-groups">
          {groups.map((g) => {
            const open = isOpen(g.date)
            return (
              <section className="rail-group" key={g.date}>
                <button
                  type="button"
                  className="rail-group-hdr"
                  aria-expanded={open}
                  onClick={() => toggle(g.date)}
                >
                  <span className={`rail-group-caret${open ? ' rail-group-caret--open' : ''}`}>
                    ▸
                  </span>
                  <span className="rail-group-date">{groupLabel(g.date, today, yesterday)}</span>
                  <span className="rail-group-count">{g.items.length}</span>
                </button>
                {open ? (
                  <ul className="rail-list">
                    {g.items.map((v) => {
                      const p = progress(v)
                      return (
                        <li
                          key={v.id}
                          className={`rail-item${v.id === selectedId ? ' rail-item--sel' : ''}`}
                          onClick={() => onSelect(v.id)}
                        >
                          <span className="rail-token" data-token={tokenState(v.status) || undefined}>{v.queue_token}</span>
                          <div className="rail-body">
                            <span className="rail-name">{v.patient_name}</span>
                            {p.total > 0 ? (
                              <span className="rail-prog" data-state={p.state}>
                                <span className="rail-prog-track">
                                  <span className="rail-prog-fill" style={{ width: `${p.pct}%` }} />
                                </span>
                                <span className="rail-prog-num">{p.answered}/{p.total}</span>
                              </span>
                            ) : null}
                          </div>
                          <StatusChip status={v.status} />
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </section>
            )
          })}
        </div>
      )}
    </aside>
  )
}
