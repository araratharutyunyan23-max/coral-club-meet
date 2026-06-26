/** Reef-ripple loader — concentric rings expanding from a coral core. The
 *  brand's "one ripple, five jobs" motion primitive, used for connecting /
 *  waiting states. */
export function RippleLoader({ size = 56 }: { size?: number }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }} aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid var(--teal)',
            animation: `ripple 1.9s ${i * 0.55}s ease-out infinite`,
          }}
        />
      ))}
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 8,
          height: 8,
          marginLeft: -4,
          marginTop: -4,
          borderRadius: '50%',
          background: 'var(--coral)',
        }}
      />
    </div>
  )
}
