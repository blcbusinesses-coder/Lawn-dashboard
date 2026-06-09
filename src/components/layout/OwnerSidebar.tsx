'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Users, Home, ClipboardCheck, Receipt, FileText, Bot,
  TrendingUp, HardHat, MessageSquare, Inbox, Star, Settings2,
  CheckSquare, BarChart2, Wrench, Gauge, Globe, CloudSun, PenTool, Filter,
  Megaphone, DollarSign, ChevronDown, LogOut, Zap, Mail, ListChecks, Crosshair, Search,
} from 'lucide-react'

type NavLeaf = { href: string; label: string; Icon: typeof FileText }
type NavItem = NavLeaf & { children?: NavLeaf[] }
type NavGroup = {
  id: string
  label: string
  Icon: typeof FileText
  accent: string
  dot: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'marketing',
    label: 'Marketing',
    Icon: Megaphone,
    accent: 'text-purple-400',
    dot: 'bg-purple-400',
    items: [
      { href: '/dashboard/ads',                    label: 'Ad Intelligence', Icon: BarChart2 },
      { href: '/dashboard/content',              label: 'Content',         Icon: PenTool },
      { href: '/dashboard/site',                 label: 'Website',         Icon: Globe },
      { href: '/dashboard/marketing/seo',        label: 'Local SEO',       Icon: Search },
      { href: '/dashboard/marketing/postcards',  label: 'Postcards',       Icon: Mail },
      {
        href: '/dashboard/marketing/letters',
        label: 'Letters',
        Icon: FileText,
        children: [
          { href: '/dashboard/marketing/letters/blast',         label: 'Area Blast',       Icon: Crosshair },
          { href: '/dashboard/marketing/letters/new-homeowner', label: 'New Homeowner',   Icon: Home },
          { href: '/dashboard/marketing/letters/violations',    label: 'Grass Violations', Icon: ListChecks },
        ],
      },
    ],
  },
  {
    id: 'crm',
    label: 'Leads & CRM',
    Icon: Filter,
    accent: 'text-blue-400',
    dot: 'bg-blue-400',
    items: [
      { href: '/dashboard/leads',      label: 'Leads',      Icon: Filter },
      { href: '/dashboard/sms',        label: 'SMS',        Icon: MessageSquare },
      { href: '/dashboard/inbox',      label: 'Inbox',      Icon: Inbox },
      { href: '/dashboard/automation', label: 'Automation', Icon: Settings2 },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    Icon: Wrench,
    accent: 'text-green-400',
    dot: 'bg-green-400',
    items: [
      { href: '/dashboard/customers',  label: 'Customers',  Icon: Users },
      { href: '/dashboard/properties', label: 'Properties', Icon: Home },
      { href: '/dashboard/jobs',       label: 'Jobs',       Icon: ClipboardCheck },
      { href: '/dashboard/equipment',  label: 'Equipment',  Icon: Wrench },
      { href: '/dashboard/weather',    label: 'Weather',    Icon: CloudSun },
      { href: '/dashboard/efficiency', label: 'Efficiency', Icon: Gauge },
      { href: '/dashboard/todos',      label: 'To-Do',      Icon: CheckSquare },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    Icon: DollarSign,
    accent: 'text-yellow-400',
    dot: 'bg-yellow-400',
    items: [
      { href: '/dashboard/money',     label: 'Overview',  Icon: TrendingUp },
      { href: '/dashboard/expenses',  label: 'Expenses',  Icon: Receipt },
      { href: '/dashboard/invoices',  label: 'Invoices',  Icon: FileText },
      { href: '/dashboard/employees', label: 'Employees', Icon: HardHat },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    Icon: Zap,
    accent: 'text-cyan-400',
    dot: 'bg-cyan-400',
    items: [
      { href: '/dashboard/agent',     label: 'AI Agent',  Icon: Bot },
      { href: '/dashboard/important', label: 'Important', Icon: Star },
    ],
  },
]

function getGroupForPath(pathname: string): string | null {
  for (const group of NAV_GROUPS) {
    if (group.items.some(item => pathname.startsWith(item.href))) return group.id
  }
  return null
}

interface OwnerSidebarProps {
  open?: boolean
  onClose?: () => void
}

export function OwnerSidebar({ open = false, onClose }: OwnerSidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const activeGroupId = getGroupForPath(pathname)

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    return new Set(activeGroupId ? [activeGroupId] : ['operations'])
  })

  // Auto-open the group containing the active page
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups(prev => {
        if (prev.has(activeGroupId)) return prev
        return new Set([...prev, activeGroupId])
      })
    }
  }, [activeGroupId])

  useEffect(() => { onClose?.() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Gray Wolf Workers" className="w-9 h-9 object-contain shrink-0" />
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
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map(group => {
          const isOpen   = openGroups.has(group.id)
          const isActive = activeGroupId === group.id

          return (
            <div key={group.id} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                  isActive
                    ? 'text-white bg-white/5'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', group.dot, isActive ? 'opacity-100' : 'opacity-50')} />
                  <group.Icon size={13} className={cn(isActive ? group.accent : '')} />
                  {group.label}
                </div>
                <ChevronDown
                  size={13}
                  className={cn('transition-transform duration-200', isOpen ? 'rotate-0' : '-rotate-90')}
                />
              </button>

              {/* Items */}
              {isOpen && (
                <ul className="mt-0.5 ml-3 pl-3 border-l border-zinc-800 space-y-0.5">
                  {group.items.map(({ href, label, Icon, children }) => {
                    const active = pathname === href
                    // A parent is "expanded" when the user is on it or any of its children.
                    const childActive = children?.some(c => pathname === c.href) ?? false
                    const showChildren = !!children && (active || childActive)
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={cn(
                            'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors',
                            active
                              ? 'bg-white/10 text-white'
                              : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
                          )}
                        >
                          <Icon size={14} strokeWidth={active ? 2.5 : 2} className={active ? 'text-white' : 'text-zinc-500'} />
                          {label}
                        </Link>

                        {showChildren && (
                          <ul className="mt-0.5 ml-3 pl-3 border-l border-zinc-800 space-y-0.5">
                            {children!.map((child) => {
                              const cActive = pathname === child.href
                              return (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    className={cn(
                                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                                      cActive
                                        ? 'bg-purple-500/15 text-purple-200'
                                        : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'
                                    )}
                                  >
                                    <child.Icon size={13} strokeWidth={cActive ? 2.5 : 2} className={cActive ? 'text-purple-300' : 'text-zinc-600'} />
                                    {child.label}
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-2 py-4 border-t border-zinc-800 shrink-0">
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
