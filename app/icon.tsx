import { ImageResponse } from 'next/og'

/**
 * Programmatic app icon so it renders sharply at all sizes (including Windows taskbar, title bar, and favicon).
 * Uses solid shapes and high contrast for clarity at 16×16 and 32×32.
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111111',
          borderRadius: 6,
        }}
      >
        {/* Outer ring for definition on any background */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '2px solid #CAF76F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Bold "D" for Demo – reads well at 16px on Windows */}
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#CAF76F',
              fontFamily: 'system-ui, sans-serif',
              lineHeight: 1,
            }}
          >
            D
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
