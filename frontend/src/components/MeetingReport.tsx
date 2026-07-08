import { initialsFor, userColor } from './Avatar'
import { useT } from '../lib/i18n'
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
  const t = useT()
  const { rows, talkers, comparable } = normalise(report.participants)
  const byPresent = [...rows].sort((a, b) => b.presentMs - a.presentMs)
  // Always sorted by activity (talk-time); falls back to time present when there's no talk data.
  const sorted = [...rows].sort((a, b) => (b.talkMs ?? -1) - (a.talkMs ?? -1) || b.presentMs - a.presentMs)

  const longest = byPresent[0]
  const active = comparable ? [...talkers].sort((a, b) => (b.talkMs as number) - (a.talkMs as number))[0] : null
  const avg = rows.length ? rows.reduce((s, p) => s + p.presentMs, 0) / rows.length : 0
  return (
    <section className="report">
      <div className="rep-head">
        <div className="rep-head-top">
          <div>
            <div className="rep-title">{t('Meeting report')}</div>
            <div className="rep-room">{report.room}</div>
          </div>
        </div>
        <div className="rep-meta">
          <span className="fact"><span className="k">{t('Date')}</span><span className="v">{dateLabel(report.startedAt)}</span></span>
          <span className="fact"><span className="k">{t('Duration')}</span><span className="v mono">{fmtDur(report.durationMs)}</span></span>
          <span className="fact"><span className="k">{t('People')}</span><span className="v">{rows.length}</span></span>
        </div>
      </div>

      <div className="rep-totals">
        <Total k={t('Longest present')}>
          <span className="hue" style={{ background: userColor(longest.name) }} />
          <span className="nm">{firstName(longest.name)}</span>
          <span className="t">{fmtDur(longest.presentMs)}</span>
        </Total>
        <Total k={t('Most active')}>
          {active ? (
            <>
              <span className="hue" style={{ background: userColor(active.name) }} />
              <span className="nm">{firstName(active.name)}</span>
            </>
          ) : (
            <span className="t" style={{ fontSize: 14 }}>{t('Not enough data')}</span>
          )}
        </Total>
        <Total k={t('Avg attendance')}>
          <span className="t" style={{ color: 'var(--text)', fontSize: 15 }}>{fmtDur(avg)}</span>
        </Total>
      </div>

      <div className={`rep-scroll${rows.length > 8 ? ' scroll' : ''}`}>
        <div className="rep-colhead">
          <span>{t('Participant')}</span>
          <span className="r">{t('Joined')}</span>
          <span className="r">{t('Left')}</span>
          <span className="r">{t('Present')}</span>
          <span>{t('Talk-time')}</span>
        </div>
        <div className="rep-rows">
          {sorted.map((p) => (
            <div key={p.id} className={`rep-row${p.isLocal ? ' you' : ''}`}>
              <div className="cell person">
                <span className="av" style={{ background: userColor(p.name) }}>{initialsFor(p.name)}</span>
                <span className="who">
                  <span className="nm">
                    <span className="nm-t">{p.name}</span>
                    {p.role === 'host' && <span className="tag">{t('Host')}</span>}
                    {p.isLocal && <span className="you-t">{t('You')}</span>}
                  </span>
                  {p.sessions > 1 ? (
                    <span className="sub"><SessionsIcon />{t('{n} sessions', { n: p.sessions })}</span>
                  ) : (
                    <span className="sub-times">{clock(p.joined)} → {p.left != null ? clock(p.left) : t('now')}</span>
                  )}
                </span>
              </div>
              <div className="cell joined">{clock(p.joined)}</div>
              <div className="cell left">
                {p.left === null ? <span className="incall"><span className="dot" />{t('In call')}</span> : clock(p.left)}
              </div>
              <div className="cell present">{fmtDur(p.presentMs)}</div>
              <div className="cell talk">
                {p.pct != null ? (
                  <>
                    <span className="bar"><span className="fill" style={{ width: `${p.pct}%` }} /></span>
                    <span className="pct">{p.pct}%</span>
                  </>
                ) : (
                  <span className="notalk"><span className="d" />{t('presence only')}</span>
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
            <h4>{t('It was just you this time')}</h4>
            <p>{t('Nobody else joined')} <b>{report.room}</b>. {t("When members attend, they'll appear here with how long they stayed and — where available — a talk-time bar.")}</p>
          </div>
        </div>
      )}

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

/* ---- icons ---- */
function SessionsIcon() {
  return <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M21 7v12a2 2 0 0 1-2 2H7" /></svg>
}
function PeopleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}
