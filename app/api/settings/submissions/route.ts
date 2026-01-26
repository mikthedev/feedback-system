import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// GET - Get submissions status (app_config.submissions_open)
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const { data: config, error } = await supabase
      .from('app_config')
      .select('submissions_open')
      .eq('id', 1)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    const submissionsOpen = config?.submissions_open ?? true

    return NextResponse.json({ submissions_open: submissionsOpen })
  } catch (error) {
    console.error('Error fetching submissions status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Toggle submissions status (curator only)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_user_id')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError || !user || user.role !== 'curator') {
      return NextResponse.json({ error: 'Forbidden: Curator access required' }, { status: 403 })
    }

    const body = await request.json()
    const { submissions_open } = body

    if (typeof submissions_open !== 'boolean') {
      return NextResponse.json({ error: 'submissions_open must be a boolean' }, { status: 400 })
    }

    const { data: current, error: fetchError } = await supabase
      .from('app_config')
      .select('submissions_open')
      .eq('id', 1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError
    const currentlyOpen = current?.submissions_open ?? true
    const rowExists = !fetchError

    if (rowExists) {
      const { error: updateError } = await supabase
        .from('app_config')
        .update({ submissions_open })
        .eq('id', 1)
      if (updateError) throw updateError
    } else {
      const { error: insertError } = await supabase
        .from('app_config')
        .insert({ id: 1, submissions_open })
      if (insertError) throw insertError
    }

    if (submissions_open && !currentlyOpen) {
      const { error: sessionError } = await supabase.rpc('get_or_create_current_session')
      if (sessionError) console.error('Error creating session:', sessionError)
    } else if (!submissions_open && currentlyOpen) {
      const { error: closeError } = await supabase.rpc('close_current_session')
      if (closeError) console.error('Error closing session:', closeError)
    }

    return NextResponse.json({
      success: true,
      submissions_open: submissions_open,
      message: submissions_open ? 'Submissions opened' : 'Submissions closed',
    })
  } catch (error) {
    console.error('Error updating submissions status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
