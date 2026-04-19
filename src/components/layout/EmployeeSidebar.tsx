'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ClipboardCheck, Clock, Wallet, Bot, LogOut } from 'lucide-react'

const navItems = [
  { href: '/employee/jobs',  label: 'Jobs',   Icon: ClipboardCheck },
  { href: '/employee/clock', label: 'Clock',  Icon: Clock },
  { href: '/employee/pay',   label: 'My Pay', Icon: Wallet },
  { href: '/employee/agent', label: 'Agent',  Icon: Bot },
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
      {/* ── DESKTOP sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 shrink-0 h-screen sticky top-0 bg-zinc-950 flex-col border-r border-zinc-800">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-zinc-800 shrink-0">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-zinc-900 font-bold text-xs tracking-wide">GW</span>
          </div>
          <div className="leading-tight">
            <p className="text-white font-semibold text-sm">Gray Wolf Workers</p>
            <p className="text-zinc-500 text-xs">Employee Portal</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <ul className="space-y-0.5">
            {navItems.map(({ href, label, Icon }) => {
              const active = pathname === href
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                    )}
                  >
                    <Icon size={16} strokeWidth={active ? 2.5 : 2} className={active ? 'text-white' : 'text-zinc-500'} />
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="px-3 py-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-100 transition-colors"
          >
            <LogOut size={16} strokeWidth={2} className="text-zinc-500" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MOBILE bottom tab bar ─────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-zinc-950 border-t border-zinc-800 flex safe-area-inset-bottom">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors',
                active ? 'text-white' : 'text-zinc-500'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />}
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium text-zinc-500 transition-colors"
        >
          <LogOut size={20} strokeWidth={2} />
          <span>Sign Out</span>
        </button>
      </nav>
    </>
  )
}
