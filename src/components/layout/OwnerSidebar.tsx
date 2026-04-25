'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Users, Home, ClipboardCheck, Receipt, FileText, Bot,
  TrendingUp, HardHat, MessageSquare, Inbox, Star, Settings2, LogOut, CheckSquare,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard/customers',  label: 'Customers',   Icon: Users },
  { href: '/dashboard/properties', label: 'Properties',  Icon: Home },
  { href: '/dashboard/jobs',       label: 'Jobs',        Icon: ClipboardCheck },
  { href: '/dashboard/expenses',   label: 'Expenses',    Icon: Receipt },
  { href: '/dashboard/invoices',   label: 'Invoices',    Icon: FileText },
  { href: '/dashboard/todos',      label: 'To-Do',       Icon: CheckSquare },
  { href: '/dashboard/agent',      label: 'Agent',       Icon: Bot },
  { href: '/dashboard/money',      label: 'Money',       Icon: TrendingUp },
  { href: '/dashboard/employees',  label: 'Employees',   Icon: HardHat },
  { href: '/dashboard/sms',        label: 'SMS',         Icon: MessageSquare },
  { href: '/dashboard/inbox',      label: 'Inbox',       Icon: Inbox },
  { href: '/dashboard/important',  label: 'Important',   Icon: Star },
  { href: '/dashboard/automation', label: 'Automation',  Icon: Settings2 },
]

interface OwnerSidebarProps {
  open?: boolean
  onClose?: () => void
}

export function OwnerSidebar({ open = false, onClose }: OwnerSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

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
        'fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 flex flex-col transition-transform duration-200 ease-in-out shadow-xl',
        'md:relative md:z-auto md:translate-x-0 md:shadow-none md:border-r md:border-zinc-800',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-zinc-900 font-bold text-xs tracking-wide">GW</span>
          </div>
          <div className="leading-tight">
            <p className="text-white font-semibold text-sm">Gray Wolf Workers</p>
            <p className="text-zinc-500 text-xs">Owner Portal</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden text-zinc-500 hover:text-white p-1 rounded transition-colors"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
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

      {/* Sign out */}
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
  )
}
