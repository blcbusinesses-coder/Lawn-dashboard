'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { OwnerSidebar } from './OwnerSidebar'

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <OwnerSidebar open={open} onClose={() => setOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 bg-zinc-950 border-b border-zinc-800 shrink-0 z-30">
          <button
            onClick={() => setOpen(true)}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-zinc-900 font-bold text-xs tracking-wide">GW</span>
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
