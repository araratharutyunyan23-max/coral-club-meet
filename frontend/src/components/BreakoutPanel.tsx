import { type CSSProperties, useEffect, useRef, useState } from 'react'
import type { Room } from 'livekit-client'
import { useParticipants } from '../lib/hooks'
import { initialsFor, userColor } from './Avatar'
import type { UseBreakout } from '../lib/breakout'

const TIMERS = [0, 5, 10, 15]

type Board = { groups: string[][]; unassigned: string[] }

function reconcile(prev: Board, count: number, assignable: string[]): Board {
  const present = new Set(assignable)
  const cols: string[][] = []
  const overflow: string[] = []
  prev.groups.forEach((c, i) => {
    const kept = c.filter((id) => present.has(id))
    if (i < count) cols.push(kept)
    else overflow.push(...kept)
  })
  while (cols.length < count) cols.push([])
  const placed = new Set(cols.flat())
  const un = [...prev.unassigned, ...overflow].filter((id) => present.has(id) && !placed.has(id))
  const known = new Set([...placed, ...un])
  for (const id of assignable) if (!known.has(id)) un.push(id)
  return { groups: cols, unassigned: [...new Set(un)] }
}

function useCountdown(endsAt?: number): number | null {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!endsAt) return
    const id = window.setInterval(() => tick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [endsAt])
  return endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : null
}
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** Host-only breakout control panel: setup (assign) ⇄ running (manage). */
export function BreakoutPanel({ room, bo, onClose }: { room: Room; bo: UseBreakout; onClose: () => void }) {
  const participants = useParticipants(room)
  const hostId = room.localParticipant.identity
  const nameMap = useRef<Record<string, string>>({})
  participants.forEach((p) => { nameMap.current[p.identity] = p.name || p.identity })
  const nameOf = (id: string) => nameMap.current[id] || id
  const assignable = participants.filter((p) => p.identity !== hostId).map((p) => p.identity)
  const asgKey = assignable.join('|')

  const running = bo.isOpen
  const [count, setCount] = useState(3)
  const [timer, setTimer] = useState(10)
  const [board, setBoard] = useState<Board>({ groups: [], unassigned: [] })
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropCol, setDropCol] = useState<number | 'un' | null>(null)
  const [msg, setMsg] = useState('')
  const inited = useRef(false)

  const autoAssign = (n: number) => {
    const cols: string[][] = Array.from({ length: n }, () => [])
    assignable.forEach((id, i) => cols[i % n].push(id))
    setBoard({ groups: cols, unassigned: [] })
  }
  const changeCount = (n: number) => {
    const c = Math.max(2, Math.min(6, n))
    setCount(c)
    autoAssign(c)
  }

  // seed once, then reconcile as people join/leave (setup only)
  useEffect(() => {
    if (running) return
    if (!inited.current) {
      if (assignable.length) { inited.current = true; autoAssign(count) }
      return
    }
    setBoard((prev) => reconcile(prev, count, assignable))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asgKey, running])

  const moveTo = (id: string, target: number | 'un') => {
    setBoard((prev) => {
      const groups = prev.groups.map((c) => c.filter((x) => x !== id))
      const un = prev.unassigned.filter((x) => x !== id)
      if (target === 'un') un.push(id)
      else groups[target].push(id)
      return { groups, unassigned: un }
    })
  }

  // running countdown (display only — the host auto-close lives in useBreakout,
  // which stays mounted even when this panel is dismissed)
  const remaining = useCountdown(running ? bo.state.endsAt : undefined)

  const openGroups = () => {
    const groups = board.groups.filter((g) => g.length > 0)
    if (!groups.length) return
    void bo.openGroups(groups, timer * 60, '')
  }

  const help = bo.state.help ?? []
  const runGroups = bo.state.groups ?? []
  const inGroups = (running ? runGroups : board.groups).reduce((a, g) => a + g.length, 0)

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={topAccent} />

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 16px 13px', borderBottom: '1px solid var(--border)' }}>
          <div style={headBadge}><GroupsIcon /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, letterSpacing: '-.01em' }}>Breakout groups</h2>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.1em', color: 'var(--text-mute)' }}>HOST ONLY</span>
          </div>
          {running && (
            <span style={runChip}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal-bright)', boxShadow: '0 0 7px var(--teal-bright)' }} />RUNNING</span>
          )}
          <button onClick={onClose} title="Close" style={closeBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        </div>

        {/* control strip */}
        {running ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, color: remaining != null && remaining <= 60 ? 'var(--coral)' : undefined }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 22, fontVariantNumeric: 'tabular-nums', color: remaining != null && remaining <= 60 ? 'var(--coral)' : 'var(--text)' }}>{remaining != null ? mmss(remaining) : '∞'}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--text-mute)' }}>{remaining != null ? 'left' : 'no timer'}</span>
            </div>
            <span style={{ flex: 1 }} />
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message all groups…" style={{ flex: '1 1 240px', minWidth: 160, padding: '9px 12px', borderRadius: 10, background: 'var(--fill-subtle)', border: '1px solid var(--border-strong)', color: 'var(--text)', fontSize: 13.5, fontFamily: 'var(--font)' }} onKeyDown={(e) => { if (e.key === 'Enter' && msg.trim()) { void bo.broadcast(msg.trim()); setMsg('') } }} />
            <button onClick={() => { if (msg.trim()) { void bo.broadcast(msg.trim()); setMsg('') } }} style={sendBtn}>Send</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={ctlLbl}>Groups</span>
              <div style={stepper}>
                <button onClick={() => changeCount(count - 1)} disabled={count <= 2} style={stepBtn(count <= 2)}>−</button>
                <span style={{ minWidth: 26, textAlign: 'center', fontSize: 15, fontWeight: 600 }}>{count}</span>
                <button onClick={() => changeCount(count + 1)} disabled={count >= 6} style={stepBtn(count >= 6)}>+</button>
              </div>
            </div>
            <button onClick={() => autoAssign(count)} style={autoBtn}>Auto-assign</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={ctlLbl}>Timer</span>
              <div style={timeSeg}>
                {TIMERS.map((t) => (
                  <button key={t} onClick={() => setTimer(t)} style={timeSegBtn(timer === t)}>{t === 0 ? 'Off' : t}</button>
                ))}
              </div>
            </div>
            <span style={{ flex: 1 }} />
            <div style={hostFloat}>
              <span style={{ ...miniAv, background: userColor(nameOf(hostId)) }}>{initialsFor(nameOf(hostId))}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <b style={{ fontSize: 11.5, fontWeight: 600 }}>You</b>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '.1em', color: 'var(--text-mute)' }}>HOST · FLOATS</span>
              </div>
            </div>
          </div>
        )}

        {/* board */}
        <div style={{ padding: '14px 16px 4px', maxHeight: '52vh', overflowY: 'auto' }}>
          {!running && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDropCol('un') }}
              onDragLeave={() => setDropCol((d) => (d === 'un' ? null : d))}
              onDrop={() => { if (dragId) moveTo(dragId, 'un'); setDropCol(null); setDragId(null) }}
              style={{ marginBottom: 12, border: `1px dashed ${dropCol === 'un' ? 'var(--teal)' : 'var(--border-strong)'}`, background: dropCol === 'un' ? 'var(--teal-tint)' : 'transparent', borderRadius: 12, padding: '9px 11px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={ctlLbl}>Unassigned</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{board.unassigned.length}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 7 }}>
                {board.unassigned.length === 0 ? (
                  <span style={{ fontSize: 11.5, color: 'var(--text-mute)' }}>Everyone's assigned — drag a name here to pull them out.</span>
                ) : board.unassigned.map((id) => (
                  <div key={id} draggable onDragStart={() => setDragId(id)} onDragEnd={() => setDragId(null)} style={uchip}>
                    <span style={{ ...miniAv, width: 22, height: 22, background: userColor(nameOf(id)) }}>{initialsFor(nameOf(id))}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{nameOf(id)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))', gap: 11 }}>
            {(running ? runGroups : board.groups).map((g, idx) => {
              const hasHelp = running && g.some((id) => help.includes(id))
              return (
                <div
                  key={idx}
                  onDragOver={running ? undefined : (e) => { e.preventDefault(); setDropCol(idx) }}
                  onDragLeave={running ? undefined : () => setDropCol((d) => (d === idx ? null : d))}
                  onDrop={running ? undefined : () => { if (dragId) moveTo(dragId, idx); setDropCol(null); setDragId(null) }}
                  style={{ border: `1px solid ${dropCol === idx ? 'var(--teal)' : hasHelp ? 'var(--coral-line)' : 'var(--border)'}`, borderRadius: 14, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: dropCol === idx ? '0 0 0 1px var(--teal)' : 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px 9px', borderBottom: '1px solid var(--border)', background: hasHelp ? 'var(--coral-tint)' : undefined }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: hasHelp ? 'var(--coral-tint)' : 'var(--teal-tint)', border: `1px solid ${hasHelp ? 'var(--coral-line)' : 'rgba(37,208,192,.28)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: hasHelp ? 'var(--coral)' : 'var(--teal-soft)' }}>{String(idx + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>Group {idx + 1}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-mute)' }}>{g.length}</span>
                  </div>

                  {hasHelp && (
                    <div onClick={() => bo.visit(idx)} style={visitRow}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)', flex: '0 0 auto', animation: 'bopulse 1.6s ease-in-out infinite' }} />
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}><b style={{ color: 'var(--coral)' }}>Help requested</b></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--teal-soft)' }}>Visit →</span>
                    </div>
                  )}

                  <div style={{ padding: 7, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 56, flex: 1 }}>
                    {g.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 46, fontSize: 11.5, color: 'var(--text-mute)', textAlign: 'center' }}>{running ? 'Empty' : 'Drag people here'}</div>
                    ) : g.map((id) => (
                      <div key={id} draggable={!running} onDragStart={running ? undefined : () => setDragId(id)} onDragEnd={running ? undefined : () => setDragId(null)} style={{ ...rosterRow, cursor: running ? 'default' : 'grab' }}>
                        <span style={{ ...miniAv, background: userColor(nameOf(id)) }}>{initialsFor(nameOf(id))}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(id)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* foot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 16px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-mute)' }}>
            <b style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{inGroups}</b> people · <b style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{running ? runGroups.length : count}</b> groups{!running && timer ? ` · ${timer} min` : ''}
          </span>
          <span style={{ flex: 1 }} />
          {running ? (
            <button onClick={() => void bo.closeAll()} style={closeAllBtn}>Close all</button>
          ) : (
            <button onClick={openGroups} disabled={inGroups === 0} style={openBtn(inGroups === 0)}>Open groups →</button>
          )}
        </div>
      </div>
    </div>
  )
}

function GroupsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><circle cx="6" cy="18" r="2.4" /><path d="M8.4 6H14M8.4 18H14M6 8.4v7.2M18 8.4v7.2" /></svg>
}

/* ---- styles ---- */
const backdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,6,8,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const dialog: CSSProperties = { position: 'relative', width: '100%', maxWidth: 880, maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: 20, border: '1px solid var(--border-strong)', background: 'var(--bg-elev)', boxShadow: '0 30px 70px rgba(0,0,0,.5)', overflow: 'hidden' }
const topAccent: CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,var(--teal),var(--teal-bright) 60%,var(--coral))', opacity: 0.9 }
const headBadge: CSSProperties = { width: 34, height: 34, borderRadius: 10, background: 'var(--teal-tint)', border: '1px solid rgba(37,208,192,.3)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }
const runChip: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6, padding: '5px 10px', borderRadius: 999, background: 'var(--teal-tint)', border: '1px solid rgba(37,208,192,.3)', font: '700 9.5px/1 var(--mono)', letterSpacing: '.1em', color: 'var(--teal-soft)' }
const closeBtn: CSSProperties = { marginLeft: 'auto', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const ctlLbl: CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--text-mute)' }
const stepper: CSSProperties = { display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 11, background: 'var(--fill-subtle)', border: '1px solid var(--border-strong)' }
const autoBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', font: '600 12.5px/1 var(--font)', cursor: 'pointer' }
const timeSeg: CSSProperties = { display: 'flex', gap: 2, padding: 3, borderRadius: 10, background: 'var(--fill-subtle)', border: '1px solid var(--border-strong)' }
const hostFloat: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 5px', borderRadius: 999, background: 'var(--fill-subtle)', border: '1px solid var(--border)' }
const miniAv: CSSProperties = { width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', font: '700 10px/1 var(--font)', flex: '0 0 auto' }
const uchip: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px 5px 5px', borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--border-strong)', cursor: 'grab' }
const rosterRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '6px 7px', borderRadius: 9 }
const visitRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, margin: '0 7px 8px', padding: '7px 10px', borderRadius: 9, background: 'var(--coral-tint)', border: '1px solid var(--coral-line)', cursor: 'pointer' }
const sendBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--teal),var(--teal-bright))', color: '#04211e', font: '700 13px/1 var(--font)' }
function stepBtn(disabled: boolean): CSSProperties {
  return { width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: disabled ? 'var(--text-mute)' : 'var(--text)', fontSize: 17, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }
}
function timeSegBtn(on: boolean): CSSProperties {
  return { padding: '6px 11px', borderRadius: 8, border: 'none', background: on ? 'var(--teal-tint)' : 'transparent', color: on ? 'var(--teal-soft)' : 'var(--text-dim)', font: '600 12px/1 var(--font)', cursor: 'pointer' }
}
function openBtn(disabled: boolean): CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 9, padding: '12px 20px', borderRadius: 11, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: 'linear-gradient(135deg,var(--teal),var(--teal-bright))', color: '#04211e', font: '700 14px/1 var(--font)' }
}
const closeAllBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '12px 20px', borderRadius: 11, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', font: '700 14px/1 var(--font)' }
