import { NextRequest } from 'next/server'

/**
 * Authorize cron / scheduled jobs.
 * Accepts Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 * In development, allows when CRON_SECRET is unset.
 */
export function assertCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development') {
      return true
    }
    // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer ') && process.env.VERCEL === '1') {
      // Without CRON_SECRET, reject in production
      return false
    }
    return false
  }

  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${secret}`) return true
  if (request.headers.get('x-cron-secret') === secret) return true
  return false
}
