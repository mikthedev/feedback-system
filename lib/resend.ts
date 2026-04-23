import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

/** Optional fields from the submission used to fill template variables (keys must match your Resend template). */
export type ConfirmationEmailContext = {
  artistName?: string | null
  songTitle?: string | null
  soundcloudUrl?: string | null
  sessionNumber?: number | null
}

type TemplateVariableMeta = { key: string }

function substituteDisplayName(value: unknown, displayName: string): string | number {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const s = String(value ?? '')
  return s.replace(/__DISPLAY_NAME__/g, displayName)
}

function looksLikeDisplayNameKey(lower: string): boolean {
  return (
    lower === 'displayname' ||
    lower === 'name' ||
    lower === 'user_name' ||
    lower === 'username' ||
    lower === 'display_name'
  )
}

function looksLikeArtistKey(lower: string): boolean {
  return lower.includes('artist') || lower.includes('band') || lower === 'creator'
}

function looksLikeSongOrTrackKey(lower: string, key: string): boolean {
  if (lower === 'product') return true // common placeholder name in examples; map to track title for demos
  return (
    lower.includes('song') ||
    lower.includes('track') ||
    (lower.includes('title') && !lower.includes('subtitle'))
  )
}

function looksLikeUrlKey(lower: string): boolean {
  return lower.includes('url') || lower.includes('link') || lower.endsWith('_href')
}

function looksLikeNumericKey(lower: string, key: string): boolean {
  return lower === 'price' || lower === 'amount' || lower === 'session' || key === 'PRICE'
}

/**
 * Builds the `variables` payload for Resend Templates.
 *
 * **Publishing:** After you edit a template in the Resend dashboard, you must **Publish** (or call
 * `templates.publish`). API sends only use the latest **published** version — drafts are ignored.
 *
 * - Templates with **no variables:** omit `variables` (empty object not sent).
 * - `RESEND_TEMPLATE_VARIABLES_JSON` overrides everything (use __DISPLAY_NAME__ in strings).
 * - Otherwise we fill keys returned by `templates.get`, using display name + optional submission context.
 */
function buildTemplateVariables(
  displayName: string,
  templateVariableKeys: string[],
  ctx?: ConfirmationEmailContext,
): Record<string, string | number> {
  const explicitJson = process.env.RESEND_TEMPLATE_VARIABLES_JSON?.trim()
  if (explicitJson) {
    const parsed = JSON.parse(explicitJson) as Record<string, unknown>
    const out: Record<string, string | number> = {}
    for (const [key, raw] of Object.entries(parsed)) {
      out[key] = substituteDisplayName(raw, displayName)
    }
    return out
  }

  if (templateVariableKeys.length === 0) {
    const preferredKey = process.env.RESEND_TEMPLATE_DISPLAY_NAME_KEY?.trim()
    if (preferredKey) {
      console.warn(
        'RESEND_TEMPLATE_DISPLAY_NAME_KEY is set but this template has no variables in Resend. Ignoring it; use RESEND_TEMPLATE_VARIABLES_JSON after adding variables in the dashboard.',
        { preferredKey },
      )
    }
    return {}
  }

  const preferredKey = process.env.RESEND_TEMPLATE_DISPLAY_NAME_KEY?.trim()
  const variables: Record<string, string | number> = {}

  for (const key of templateVariableKeys) {
    const lower = key.toLowerCase()
    let value: string | number | undefined

    if (preferredKey && key === preferredKey) {
      value = displayName
    } else if (!preferredKey && looksLikeDisplayNameKey(lower)) {
      value = displayName
    } else if (ctx) {
      if (looksLikeArtistKey(lower)) {
        const v = ctx.artistName?.trim()
        if (v) value = v
      } else if (looksLikeSongOrTrackKey(lower, key)) {
        const v = ctx.songTitle?.trim()
        if (v) value = v
      } else if (looksLikeUrlKey(lower)) {
        const v = ctx.soundcloudUrl?.trim()
        if (v) value = v
      } else if (looksLikeNumericKey(lower, key)) {
        if (typeof ctx.sessionNumber === 'number' && !Number.isNaN(ctx.sessionNumber)) {
          value = ctx.sessionNumber
        }
      }
    }

    if (value !== undefined && value !== '') {
      variables[key] = value
    }
  }

  return variables
}

export async function sendConfirmationEmail(
  to: string,
  displayName: string,
  ctx?: ConfirmationEmailContext,
) {
  try {
    const from = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'
    const subject = 'Demo Submission Confirmed'
    const templateId = process.env.RESEND_TEMPLATE_ID?.trim()
    const allowTemplateFallback = process.env.RESEND_TEMPLATE_ALLOW_FALLBACK !== 'false'

    const fallbackHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Demo Submission Confirmed</h2>
        <p>Hi ${displayName},</p>
        <p>Your demo was successfully submitted and is now in the review queue.</p>
        <p>You'll be notified once MikeGTC has reviewed your submission.</p>
        <p>Thanks for sharing your music!</p>
      </div>
    `

    if (templateId) {
      let templateVariableKeys: string[] = []

      try {
        const meta = await resend.templates.get(templateId)

        if (meta.error) {
          console.error(
            'Resend templates.get failed — will still try template send (variable list unknown):',
            { templateId, error: meta.error },
          )
        } else {
          const t = meta.data as
            | {
                status?: string
                html?: string | null
                text?: string | null
                variables?: TemplateVariableMeta[]
              }
            | undefined

          templateVariableKeys = (t?.variables ?? []).map((v) => v.key).filter(Boolean)

          if (t?.status && t.status !== 'published') {
            console.error(
              `Template status is "${t.status}". Only published templates are used for sends — open Resend → Templates → Publish your latest changes.`,
              { templateId },
            )
          }

          const htmlLen = t?.html?.length ?? 0
          const textLen = t?.text?.length ?? 0
          if (htmlLen < 20 && textLen > 0) {
            console.warn(
              'Resend template has very little HTML but has text. Some inboxes may show this as plain text. Add HTML in the template editor.',
              { templateId, htmlLen, textLen },
            )
          }

          console.info('Resend template metadata', {
            templateId,
            status: t?.status,
            variableKeys: templateVariableKeys,
          })
        }
      } catch (e) {
        console.warn('Could not fetch Resend template metadata before send; will still try template send.', {
          templateId,
          e,
        })
      }

      try {
        const variables = buildTemplateVariables(displayName, templateVariableKeys, ctx)

        const templatePayload: { id: string; variables?: Record<string, string | number> } = {
          id: templateId,
        }
        if (Object.keys(variables).length > 0) {
          templatePayload.variables = variables
        }

        const { data, error } = await resend.emails.send({
          from,
          to,
          template: templatePayload,
        })

        if (!error) {
          console.info('Resend template email sent successfully', {
            templateId,
            to,
            emailId: data?.id,
          })
          return { success: true, data }
        }

        console.error('Resend template send error:', {
          templateId,
          to,
          error,
        })
        if (!allowTemplateFallback) {
          return { success: false, error }
        }
      } catch (templateSendError) {
        console.warn('Failed to send with Resend template.', {
          templateId,
          to,
          templateSendError,
        })
        if (!allowTemplateFallback) {
          return { success: false, error: templateSendError }
        }
      }
    }

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: fallbackHtml,
    })

    if (error) {
      console.error('Resend error:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error }
  }
}
