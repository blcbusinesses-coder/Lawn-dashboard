'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const navItems = [
  { href: '/dashboard/customers', label: 'Customers', icon: '👥' },
  { href: '/dashboard/properties', label: 'Properties', icon: '🏡' },
  { href: '/dashboard/jobs', label: 'Jobs', icon: '✅' },
  { href: '/dashboard/expenses', label: 'Expenses', icon: '🧾' },
  { href: '/dashboard/invoices', label: 'Invoices', icon: '📄' },
  { href: '/dashboard/agent', label: 'Agent', icon: '🤖' },
  { href: '/dashboard/money', label: 'Money', icon: '💰' },
  { href: '/dashboard/employees', label: 'Employees', icon: '👷' },
  { href: '/dashboard/sms', label: 'SMS', icon: '💬' },
  { href: '/dashboard/inbox', label: 'Inbox', icon: '💬' },
  { href: '/dashboard/important', label: 'Important', icon: '⭐' },
]

export function OwnerSidebar() {
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
    <aside className="w-60 shrink-0 h-screen sticky top-0 bg-zinc-900 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
            <span className="text-zinc-900 font-bold text-xs">GW</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Gray Wolf Workers</p>
            <p className="text-zinc-500 text-xs">Owner Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
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

      {/* Sign out */}
      <div className="px-2 py-4 border-t border-zinc-800">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <span className="text-base">🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  )
}
