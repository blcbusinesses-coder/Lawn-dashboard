import { EmployeeSidebar } from '@/components/layout/EmployeeSidebar'

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <EmployeeSidebar />
      {/* pb-16 reserves space for the mobile bottom tab bar */}
      <main className="flex-1 overflow-y-auto bg-zinc-50 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
