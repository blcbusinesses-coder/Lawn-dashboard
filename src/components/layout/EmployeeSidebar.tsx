'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const navItems = [
  { href: '/employee/jobs', label: 'Jobs', icon: '✅' },
  { href: '/employee/clock', label: 'Clock', icon: '⏱️' },
  { href: '/employee/agent', label: 'Agent', icon: '🤖' },
]

export function EmployeeSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* ── DESKTOP: left sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 shrink-0 h-screen sticky top-0 bg-zinc-900 flex-col">
        <div className="px-5 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
              <span className="text-zinc-900 font-bold text-xs">GW</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Gray Wolf Workers</p>
              <p className="text-zinc-500 text-xs">Employee Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-0.5 px-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    pathname === item.href
                      ? 'bg-zinc-700 text-white font-medium'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  )}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-2 py-4 border-t border-zinc-800">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <span className="text-base">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MOBILE: bottom tab bar ────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-zinc-900 border-t border-zinc-800 flex">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs transition-colors',
              pathname === item.href
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
            {pathname === item.href && (
              <span className="absolute top-0 h-0.5 w-8 bg-white rounded-full" />
            )}
          </Link>
        ))}
        <button
          onClick={handleSignOut}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <span className="text-xl leading-none">🚪</span>
          <span className="font-medium">Sign Out</span>
        </button>
      </nav>
    </>
  )
}
