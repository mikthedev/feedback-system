import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Test endpoint to verify Supabase connection
export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        error: 'Missing environment variables',
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey,
      }, { status: 500 })
    }

    // Create admin client
    const supabase = createAdminClient()

    // Test 1: Check if we can query users table
    const { data: users, error: usersError, count: usersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .limit(5)

    if (usersError) {
      return NextResponse.json({
        error: 'Database query failed',
        details: usersError.message,
        code: usersError.code,
        hint: usersError.hint,
      }, { status: 500 })
    }

    // Test 2: Check if we can query submissions table
    const { data: submissions, error: submissionsError, count: submissionsCount } = await supabase
      .from('submissions')
      .select('*', { count: 'exact' })
      .limit(5)

    if (submissionsError) {
      return NextResponse.json({
        error: 'Submissions query failed',
        details: submissionsError.message,
        code: submissionsError.code,
        hint: submissionsError.hint,
      }, { status: 500 })
    }

    // Test 3: Check if we can query reviews table
    const { data: reviews, error: reviewsError, count: reviewsCount } = await supabase
      .from('reviews')
      .select('*', { count: 'exact' })
      .limit(5)

    if (reviewsError) {
      return NextResponse.json({
        error: 'Reviews query failed',
        details: reviewsError.message,
        code: reviewsError.code,
        hint: reviewsError.hint,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase connection is working!',
      stats: {
        users: usersCount || 0,
        submissions: submissionsCount || 0,
        reviews: reviewsCount || 0,
      },
      sampleData: {
        users: users?.length || 0,
        submissions: submissions?.length || 0,
        reviews: reviews?.length || 0,
      },
    })
  } catch (error) {
    console.error('Test DB error:', error)
    return NextResponse.json({
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
