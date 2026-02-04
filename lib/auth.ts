import { createAdminClient } from './supabase/admin'
import { cookies } from 'next/headers'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session_user_id')?.value

  if (!userId) {
    return null
  }

  const supabase = createAdminClient()
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (userError || !userData) {
    return null
  }

  return userData
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireCurator() {
  const user = await requireAuth()
  if (user.role !== 'curator') {
    throw new Error('Forbidden: MikeGTC access required')
  }
  return user
}
