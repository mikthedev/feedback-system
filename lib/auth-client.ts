'use client'

export async function getCurrentUser() {
  const response = await fetch('/api/auth/me')
  if (!response.ok) return null
  return await response.json()
}

export async function logout() {
  const response = await fetch('/api/auth/logout', { method: 'POST' })
  if (response.ok) {
    window.location.href = '/'
  }
}
