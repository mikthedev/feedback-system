import { resend } from '@/lib/resend'
import { formatMonthLabel } from '@/lib/totm-selection'

const from = () => process.env.RESEND_FROM_EMAIL || 'noreply@example.com'

async function sendHtmlEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<{ success: boolean; error?: unknown }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('TOTM email skipped: RESEND_API_KEY not set')
      return { success: false, error: 'RESEND_API_KEY missing' }
    }
    const { data, error } = await resend.emails.send({
      from: from(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    if (error) {
      console.error('TOTM email error:', error)
      return { success: false, error }
    }
    return { success: true }
  } catch (error) {
    console.error('TOTM email send failed:', error)
    return { success: false, error }
  }
}

export async function sendTotmFeaturedArtistEmail(
  to: string,
  displayName: string,
  ctx: { year: number; month: number }
) {
  const label = formatMonthLabel(ctx.year, ctx.month)
  return sendHtmlEmail({
    to,
    subject: 'You’re a TOTM Featured Artist — MikeGTC',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <h2 style="margin-bottom: 8px;">TOTM Featured Artist</h2>
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>
          Congratulations — your track entered <strong>Top of the Month</strong> for
          <strong>${escapeHtml(label)}</strong>.
        </p>
        <p>
          You’ve earned permanent <strong>TOTM Featured Artist</strong> recognition.
          This stays with you even if your track is later displaced from the Top 10
          or becomes unavailable on SoundCloud.
        </p>
        <p>
          In Twitch chat you may receive a special icon and distinctive username styling
          where supported (VIP badge when channel configuration allows).
        </p>
        <p>Keep creating. — MikeGTC</p>
      </div>
    `,
  })
}

export async function sendTotmQueueSkipEmail(
  to: string,
  displayName: string,
  ctx: { year: number; month: number; trackTitle?: string | null }
) {
  const label = formatMonthLabel(ctx.year, ctx.month)
  const trackLine = ctx.trackTitle
    ? `<p>Your track <strong>${escapeHtml(ctx.trackTitle)}</strong> finished in the final Top 10.</p>`
    : `<p>Your track finished in the final Top 10 for ${escapeHtml(label)}.</p>`

  return sendHtmlEmail({
    to,
    subject: `Your TOTM queue skip for ${label} — MikeGTC`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <h2 style="margin-bottom: 8px;">TOTM Queue Skip Granted</h2>
        <p>Hi ${escapeHtml(displayName)},</p>
        ${trackLine}
        <p>
          You’ve received <strong>one queue skip</strong> for ${escapeHtml(label)}.
          It does not use XP.
        </p>
        <p><strong>How to activate it:</strong></p>
        <ol>
          <li>Open Submit Demo when submissions are open.</li>
          <li>Turn on <em>Activate TOTM queue skip</em> before you confirm.</li>
          <li>Your track is placed immediately after the track currently being reviewed
              (never interrupting an ongoing review). Other priority skips keep their order.</li>
        </ol>
        <p>
          The skip is only consumed when your submission actually begins review.
          If placement fails, the skip stays available.
        </p>
        <p>— MikeGTC</p>
      </div>
    `,
  })
}

export async function sendTotmTrackUnavailableEmail(
  to: string,
  displayName: string,
  ctx: {
    year: number
    month: number
    trackTitle?: string | null
    soundcloudUrl: string
  }
) {
  const label = formatMonthLabel(ctx.year, ctx.month)
  const title = ctx.trackTitle ? escapeHtml(ctx.trackTitle) : 'your track'

  return sendHtmlEmail({
    to,
    subject: `TOTM update: ${label} track unavailable — MikeGTC`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
        <h2 style="margin-bottom: 8px;">Removed from active Top of the Month</h2>
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>
          <strong>${title}</strong> appears deleted, private, or otherwise unavailable on SoundCloud,
          so it was removed from the <strong>active</strong> Top of the Month list for
          ${escapeHtml(label)}.
        </p>
        <p>
          Your <strong>TOTM Featured Artist</strong> recognition is permanent and unchanged.
          Any queue skip you already earned is also preserved.
        </p>
        <p style="color:#666;font-size:12px;">Link checked: ${escapeHtml(ctx.soundcloudUrl)}</p>
        <p>— MikeGTC</p>
      </div>
    `,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
