import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  style?: CSSProperties
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

export const MicIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="21" />
    <line x1="8" y1="21" x2="16" y2="21" />
  </svg>
)

export const MicOffIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="21" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="4" y1="3" x2="20" y2="21" />
  </svg>
)

export const CameraIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3z" />
  </svg>
)

export const CameraOffIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3z" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
)

export const ScreenShareIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <path d="M12 12V8M9.6 10 12 7.6 14.4 10" />
  </svg>
)

export const ChatIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M21 14.5a2 2 0 0 1-2 2H8l-4 3.5V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
  </svg>
)

export const PeopleIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M16 19v-1.4a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 17.6V19" />
    <circle cx="10" cy="8" r="3.4" />
    <path d="M20 19v-1.4a3.4 3.4 0 0 0-2.6-3.3" />
    <path d="M15.4 4.7a3.4 3.4 0 0 1 0 6.6" />
  </svg>
)

export const ReactIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14s1.3 2 3.5 2 3.5-2 3.5-2" />
    <line x1="9" y1="9.6" x2="9.01" y2="9.6" />
    <line x1="15" y1="9.6" x2="15.01" y2="9.6" />
  </svg>
)

// Bold, solid raised hand — a filled palm with thick round-capped fingers so it
// stays legible at small sizes and on the coral chip/badge (the old thin outline
// blended into the background).
export const HandIcon = ({ size = 20, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <path d="M6.3 12H17.2V16.4A5.45 5.45 0 0 1 11.75 21.85A5.45 5.45 0 0 1 6.3 16.4Z" fill="currentColor" />
    <g stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" fill="none">
      <path d="M8 13.2V6.4" />
      <path d="M10.75 13.2V4.7" />
      <path d="M13.5 13.2V5.7" />
      <path d="M16 13.2V8" />
      <path d="M7.1 14 4.5 16.5" />
    </g>
  </svg>
)

export const LeaveIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size)} style={{ transform: 'rotate(135deg)', ...style }} strokeWidth={1.9}>
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L16 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
)

export const MoreIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="5" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="19" cy="12" r="1.5" />
  </svg>
)

export const CloseIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
)

export const SendIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

export const SunIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

export const MoonIcon = ({ size = 18, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

export const RecordIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />
  </svg>
)

export const QAIcon = ({ size = 20, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.3 9.2a2.7 2.7 0 0 1 5.2 1c0 1.7-2.5 2.1-2.5 3.8" />
    <line x1="12" y1="17.5" x2="12.01" y2="17.5" />
  </svg>
)
