import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — can't set cookies, ignore
          }
        },
      },
    }
  )
}

/**
 * TRUE service-role client — bypasses RLS for ALL operations including Storage.
 *
 * IMPORTANT: `createAdminClient` below is built on `@supabase/ssr` and attaches
 * the request cookies. When an authenticated user's session cookie is present,
 * @supabase/ssr sends THAT user's JWT as the Authorization header instead of
 * the service-role key — so Storage uploads run as the user and are blocked by
 * RLS (there is no INSERT policy granting users write access to the buckets).
 *
 * This client uses @supabase/supabase-js directly with NO session/cookies, so
 * the service-role key is always used. Use it for Storage uploads and any
 * operation that must truly bypass RLS.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function createAdminClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
