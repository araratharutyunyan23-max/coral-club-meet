import type { Room } from 'livekit-client'
import { useParticipants } from '../lib/hooks'
import { stageContainer } from '../lib/styles'
import { ParticipantTile } from './ParticipantTile'

/** Chooses a column count that keeps tiles reasonably square. */
function columnsFor(count: number): number {
  if (count <= 1) return 1
  if (count <= 4) return 2
  if (count <= 9) return 3
  if (count <= 16) return 4
  return 5
}

/** Gallery view — every participant in an evenly sized grid. */
export function GridView({ room, isHost = false }: { room: Room; isHost?: boolean }) {
  const participants = useParticipants(room)
  const cols = columnsFor(participants.length)

  return (
    <div
      style={{
        ...stageContainer,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridAutoRows: '1fr',
        gap: 12,
      }}
    >
      {participants.map((p) => (
        <ParticipantTile key={p.sid || p.identity} participant={p} isLocal={p === room.localParticipant} room={room} isHost={isHost} />
      ))}
    </div>
  )
}
