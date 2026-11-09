/** Leaderboard / podium icon for Top of the Month (no star). */
export default function TotmLeaderboardIcon({
  className = 'h-4 w-4',
}: {
  className?: string
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Podium bars: 2nd / 1st / 3rd */}
      <path d="M4 20V12h4v8H4z" />
      <path d="M10 20V6h4v14h-4z" />
      <path d="M16 20v-5h4v5h-4z" />
    </svg>
  )
}

/** Compact skip / priority badge icon for queue skip rewards. */
export function TotmSkipIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 4l10 8-10 8V4z" />
      <path d="M19 5v14" />
    </svg>
  )
}
