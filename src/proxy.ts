import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

async function getRole(supabase: ReturnType<typeof createServerClient>, user: { id: string; app_metadata?: Record<string, unknown> }): Promise<string | null> {
  // Try JWT app_metadata first (fast, no DB query)
  const metaRole = user.app_metadata?.role as string | undefined
  if (metaRole) return metaRole

  // Fall back to profiles table (hook not yet active or first login)
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (data?.role as string) ?? null
}

export async function proxy(request: NextRequest) {
  // If Supabase env vars aren't set (e.g. misconfigured deployment), pass through
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/quote') ||        // public lead form
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/')
  ) {
    if (user && pathname.startsWith('/login')) {
      const role = await getRole(supabase, user)
      const redirectTo = role === 'employee' ? '/employee/jobs' : '/dashboard/customers'
      return NextResponse.redirect(new URL(redirectTo, request.url))
    }
    return supabaseResponse
  }

  // Protected routes — require auth
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = await getRole(supabase, user)

  // No profile yet — let them through to avoid redirect loop
  if (!role) {
    return supabaseResponse
  }

  if (pathname.startsWith('/dashboard') && role !== 'owner') {
    return NextResponse.redirect(new URL('/employee/jobs', request.url))
  }

  if (pathname.startsWith('/employee') && role !== 'employee') {
    return NextResponse.redirect(new URL('/dashboard/customers', request.url))
  }

  if (pathname === '/') {
    const redirectTo = role === 'employee' ? '/employee/jobs' : '/dashboard/customers'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
