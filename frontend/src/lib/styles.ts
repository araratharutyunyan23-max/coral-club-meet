import type { CSSProperties } from 'react'

/**
 * Absolute-fill container for the in-call views. They now render inside the
 * inset, rounded call stage (see CallRoom), which already provides the margin
 * from the surround and clears the control bar — so this is just a small,
 * uniform inner padding for the tile gutter, shared by Grid / Focus / Webinar.
 */
export const stageContainer: CSSProperties = {
  position: 'absolute',
  inset: 0,
  padding: 14,
}
