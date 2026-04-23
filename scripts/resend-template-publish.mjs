/**
 * Push local confirmation HTML to Resend: templates.update → templates.publish.
 * Loads .env then .env.local from the project root (same as other scripts).
 *
 * Requires: RESEND_API_KEY, RESEND_TEMPLATE_ID
 * Optional: RESEND_TEMPLATE_HTML_PATH (default email-templates/confirmation-email.html)
 * Optional: RESEND_TEMPLATE_NO_PUBLISH=1 (update only, no publish)
 */

import { config as loadEnv } from 'dotenv'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Resend } from 'resend'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const envPath = join(root, '.env')
const envLocalPath = join(root, '.env.local')
loadEnv({ path: envPath })
loadEnv({ path: envLocalPath, override: true })

const apiKey = process.env.RESEND_API_KEY?.trim()
const templateId = process.env.RESEND_TEMPLATE_ID?.trim()
const htmlPath =
  process.env.RESEND_TEMPLATE_HTML_PATH?.trim() || join(root, 'email-templates', 'confirmation-email.html')
const skipPublish = process.env.RESEND_TEMPLATE_NO_PUBLISH === '1'

if (!apiKey) {
  console.error('[resend-template] RESEND_API_KEY is missing. Set it in .env.local')
  process.exit(1)
}
if (!templateId) {
  console.error('[resend-template] RESEND_TEMPLATE_ID is missing. Set it in .env.local')
  process.exit(1)
}

let html
try {
  html = readFileSync(htmlPath, 'utf8')
} catch (e) {
  console.error(`[resend-template] Cannot read HTML file: ${htmlPath}`)
  console.error(e)
  process.exit(1)
}

const resend = new Resend(apiKey)

const updateResult = await resend.templates.update(templateId, { html })
if (updateResult.error) {
  console.error('[resend-template] update failed:', updateResult.error)
  process.exit(1)
}

console.log('[resend-template] updated template', templateId, updateResult.data?.id ?? '')

if (skipPublish) {
  console.log('[resend-template] RESEND_TEMPLATE_NO_PUBLISH=1 — skipping publish')
  process.exit(0)
}

const publishResult = await resend.templates.publish(templateId)
if (publishResult.error) {
  console.error('[resend-template] publish failed:', publishResult.error)
  process.exit(1)
}

console.log('[resend-template] published template', templateId, publishResult.data?.id ?? '')
