'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
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
  { href: '/dashboard/inbox', label: 'Inbox', icon: '📥' },
  { href: '/dashboard/important', label: 'Important', icon: '⭐' },
  { href: '/dashboard/automation', label: 'Automation', icon: '⚙️' },
]

interface OwnerSidebarProps {
  open?: boolean
  onClose?: () => void
}

export function OwnerSidebar({ open = false, onClose }: OwnerSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Auto-close on navigation (mobile)
  useEffect(() => { onClose?.() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        // Mobile: fixed overlay drawer, slides in/out
        'fixed inset-y-0 left-0 z-50 w-72 bg-zinc-900 flex flex-col transition-transform duration-200 ease-in-out',
        // Desktop: static sidebar
        'md:relative md:z-auto md:w-60 md:shrink-0 md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
            <span className="text-zinc-900 font-bold text-xs">GW</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Gray Wolf Workers</p>
            <p className="text-zinc-500 text-xs">Owner Portal</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden text-zinc-400 hover:text-white p-1 transition-colors"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
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

      {/* Sign out */}
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
  )
}
