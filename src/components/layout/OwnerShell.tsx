'use client'

import { useState } from 'react'
import { OwnerSidebar } from './OwnerSidebar'

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <OwnerSidebar open={open} onClose={() => setOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 bg-zinc-900 shrink-0 z-30">
          <button
            onClick={() => setOpen(true)}
            className="text-zinc-400 hover:text-white p-1 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center shrink-0">
              <span className="text-zinc-900 font-bold text-xs">GW</span>
            </div>
            <span className="text-white font-semibold text-sm">Gray Wolf Workers</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-zinc-50">
          {children}
        </main>
      </div>
    </div>
  )
}
