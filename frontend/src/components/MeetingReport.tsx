import { useState } from 'react'
import { initialsFor, userColor } from './Avatar'
import type { MeetingReport as Report, ReportParticipant } from '../lib/attendance'

/** Duration as m:ss (or h:mm:ss past an hour). */
function fmtDur(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
/** Wall-clock H:MM for a join/leave moment. */
function clock(ms: number): string {
  const d = new Date(ms)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
function dateLabel(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}
function firstName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[0] + (parts[1] ? ' ' + parts[1][0] + '.' : '')
}

type Row = ReportParticipant & { pct: number | null }

/** Normalise talk-time relative to the busiest speaker; needs ≥2 with data. */
function normalise(people: ReportParticipant[]) {
  const talkers = people.filter((p) => p.talkMs != null)
  const maxTalk = Math.max(0, ...talkers.map((p) => p.talkMs as number))
  const comparable = talkers.length >= 2 && maxTalk > 0
  const rows: Row[] = people.map((p) => ({
    ...p,
    pct: comparable && p.talkMs != null ? Math.max(3, Math.round((100 * (p.talkMs as number)) / maxTalk)) : null,
  }))
  return { rows, talkers, maxTalk, comparable }
}

/**
 * Host-only post-call summary: who attended, how long, and (best-effort) who
 * spoke — with CSV / copy export. Presence is the hero; talk-time gracefully
 * omits per row when unavailable. Styles live in theme.css (.report / .rep-*).
 */
export function MeetingReport({ report }: { report: Report }) {
  const [sortBy, setSortBy] = useState<'present' | 'talk'>('present')
  const [copied, setCopied] = useState(false)

  const { rows, talkers, comparable } = normalise(report.participants)
  const byPresent = [...rows].sort((a, b) => b.presentMs - a.presentMs)
  const sorted = sortBy === 'talk' ? [...rows].sort((a, b) => (b.talkMs ?? -1) - (a.talkMs ?? -1) || b.presentMs - a.presentMs) : byPresent

  const longest = byPresent[0]
  const active = comparable ? [...talkers].sort((a, b) => (b.talkMs as number) - (a.talkMs as number))[0] : null
  const avg = rows.length ? rows.reduce((s, p) => s + p.presentMs, 0) / rows.length : 0
  const inCall = rows.filter((p) => p.left === null).length

  const downloadCsv = () => {
    const blob = new Blob([buildCsv(report)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${report.room}-meeting-report.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummary(report))
    } catch {
      /* ignore */
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="report">
      <div className="rep-head">
        <div className="rep-head-top">
          <div>
            <div className="rep-title">Meeting report</div>
            <div className="rep-room">{report.room}</div>
          </div>
          <div className="rep-hostonly" title="Only the host can see this report">
            <LockIcon />
            Host only
          </div>
        </div>
        <div className="rep-meta">
          <span className="fact"><span className="k">Date</span><span className="v">{dateLabel(report.startedAt)}</span></span>
          <span className="fact"><span className="k">Duration</span><span className="v mono">{fmtDur(report.durationMs)}</span></span>
          <span className="fact"><span className="k">People</span><span className="v">{rows.length}</span></span>
        </div>
      </div>

      <div className="rep-totals">
        <Total k="Longest present">
          <span className="hue" style={{ background: userColor(longest.name) }} />
          <span className="nm">{firstName(longest.name)}</span>
          <span className="t">{fmtDur(longest.presentMs)}</span>
        </Total>
        <Total k="Most active">
          {active ? (
            <>
              <span className="hue" style={{ background: userColor(active.name) }} />
              <span className="nm">{firstName(active.name)}</span>
            </>
          ) : (
            <span className="t" style={{ fontSize: 14 }}>Not enough data</span>
          )}
        </Total>
        <Total k="Avg attendance">
          <span className="t" style={{ color: 'var(--text)', fontSize: 15 }}>{fmtDur(avg)}</span>
        </Total>
      </div>

      <div className="rep-toolbar">
        <div className="rep-count">
          {rows.length} {rows.length === 1 ? 'person' : 'people'}{inCall ? ` · ${inCall} still in call` : ''}
        </div>
        <div className="rep-sort">
          <span className="sl">Sort</span>
          <div className="seg2">
            <button className={sortBy === 'present' ? 'on' : ''} onClick={() => setSortBy('present')}>Time present</button>
            <button className={sortBy === 'talk' ? 'on' : ''} onClick={() => setSortBy('talk')}>Talk-time</button>
          </div>
        </div>
      </div>

      <div className={`rep-scroll${rows.length > 8 ? ' scroll' : ''}`}>
        <div className="rep-colhead">
          <span>Participant</span>
          <span className="r">Joined</span>
          <span className="r">Left</span>
          <span className="r">Present</span>
          <span>Talk-time</span>
        </div>
        <div className="rep-rows">
          {sorted.map((p) => (
            <div key={p.id} className={`rep-row${p.isLocal ? ' you' : ''}`}>
              <div className="cell person">
                <span className="av" style={{ background: userColor(p.name) }}>{initialsFor(p.name)}</span>
                <span className="who">
                  <span className="nm">
                    <span className="nm-t">{p.name}</span>
                    {p.role === 'host' && <span className="tag">Host</span>}
                    {p.isLocal && <span className="you-t">You</span>}
                  </span>
                  {p.sessions > 1 ? (
                    <span className="sub"><SessionsIcon />{p.sessions} sessions</span>
                  ) : (
                    <span className="sub-times">{clock(p.joined)} → {p.left != null ? clock(p.left) : 'now'}</span>
                  )}
                </span>
              </div>
              <div className="cell joined">{clock(p.joined)}</div>
              <div className="cell left">
                {p.left === null ? <span className="incall"><span className="dot" />In call</span> : clock(p.left)}
              </div>
              <div className="cell present">{fmtDur(p.presentMs)}</div>
              <div className="cell talk">
                {p.pct != null ? (
                  <>
                    <span className="bar"><span className="fill" style={{ width: `${p.pct}%` }} /></span>
                    <span className="pct">{p.pct}%</span>
                  </>
                ) : (
                  <span className="notalk"><span className="d" />presence only</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {rows.length <= 1 && (
        <div className="rep-empty">
          <div className="ico"><PeopleIcon /></div>
          <div>
            <h4>It was just you this time</h4>
            <p>Nobody else joined <b>{report.room}</b>. When members attend, they’ll appear here with how long they stayed and — where available — a talk-time bar.</p>
          </div>
        </div>
      )}

      <div className="rep-actions">
        <div className="rep-gen">Generated just now · visible to host only</div>
        <div className="rep-btns">
          <button className={`btn-copy${copied ? ' ok' : ''}`} onClick={copySummary}>
            <CopyIcon />
            <span>{copied ? 'Copied ✓' : 'Copy summary'}</span>
          </button>
          <button className="btn-csv" onClick={downloadCsv}>
            <DownloadIcon />
            <span>Download CSV</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function Total({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="tot">
      <div className="tot-k">{k}</div>
      <div className="tot-v">{children}</div>
    </div>
  )
}

/* ---- export builders ---- */
function buildCsv(report: Report): string {
  const people = [...report.participants].sort((a, b) => b.presentMs - a.presentMs)
  const talkers = people.filter((p) => p.talkMs != null)
  const maxTalk = Math.max(0, ...talkers.map((p) => p.talkMs as number))
  const comparable = talkers.length >= 2 && maxTalk > 0
  const head = ['Name', 'Role', 'Joined', 'Left', 'Sessions', 'Present (mm:ss)', 'Present (s)', 'Talk (s)', 'Talk (%)', 'Still in call']
  const rows = people.map((p) => [
    p.name,
    p.role,
    clock(p.joined),
    p.left != null ? clock(p.left) : '',
    p.sessions,
    fmtDur(p.presentMs),
    Math.round(p.presentMs / 1000),
    p.talkMs != null ? Math.round(p.talkMs / 1000) : '',
    comparable && p.talkMs != null ? Math.round((100 * (p.talkMs as number)) / maxTalk) : '',
    p.left === null ? 'yes' : 'no',
  ])
  const esc = (v: unknown) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}

function buildSummary(report: Report): string {
  const people = [...report.participants].sort((a, b) => b.presentMs - a.presentMs)
  const talkers = people.filter((p) => p.talkMs != null)
  const maxTalk = Math.max(0, ...talkers.map((p) => p.talkMs as number))
  const comparable = talkers.length >= 2 && maxTalk > 0
  const host = people.find((p) => p.role === 'host')
  const active = comparable ? [...talkers].sort((a, b) => (b.talkMs as number) - (a.talkMs as number))[0] : null
  const avg = people.length ? people.reduce((s, p) => s + p.presentMs, 0) / people.length : 0
  const w = Math.max(...people.map((p) => p.name.length))
  const lines = people.map((p, i) => {
    const n = String(i + 1).padStart(2, ' ')
    const nm = p.name.padEnd(w)
    const notes: string[] = []
    if (p.left === null) notes.push('in call')
    if (p.sessions > 1) notes.push(`${p.sessions} sessions`)
    const note = notes.length ? ` · ${notes.join(' · ')}` : ''
    const talk = comparable ? (p.talkMs != null ? `talk ${Math.round((100 * (p.talkMs as number)) / maxTalk)}%` : 'talk n/a') : ''
    return `${n}. ${nm}  ${fmtDur(p.presentMs).padStart(6, ' ')}${note}${talk ? '   ' + talk : ''}`
  })
  return [
    `Coral Club Meet — ${report.room}`,
    `${dateLabel(report.startedAt)} · ${fmtDur(report.durationMs)} · ${people.length} ${people.length === 1 ? 'person' : 'people'}`,
    `Host: ${host ? host.name : '—'}`,
    ``,
    `Attendance — by time present`,
    ...lines,
    ``,
    `Longest present   ${people[0].name} · ${fmtDur(people[0].presentMs)}`,
    `Most active       ${active ? active.name : 'not enough data'}`,
    `Avg attendance    ${fmtDur(avg)}`,
    ``,
    `${report.room} · generated by Coral Club Meet`,
  ].join('\n')
}

/* ---- icons ---- */
function LockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
}
function SessionsIcon() {
  return <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M21 7v12a2 2 0 0 1-2 2H7" /></svg>
}
function PeopleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
function CopyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
}
function DownloadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M5 21h14" /></svg>
}
