'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { CheckCircle2, Circle, Trash2, Pencil, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AssignTarget {
  id: string
  full_name?: string
  name?: string
}

interface Todo {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'done'
  priority: 'low' | 'normal' | 'high'
  due_date: string | null
  assign_type: 'customer' | 'employee' | 'equipment' | null
  assigned_customer_id: string | null
  assigned_employee_id: string | null
  assigned_equipment_id: string | null
  customer: AssignTarget | null
  employee: AssignTarget | null
  equipment: AssignTarget | null
  created_at: string
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-zinc-100 text-zinc-500',
  normal: 'bg-blue-50 text-blue-600',
  high: 'bg-red-50 text-red-600',
}

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'normal',
  due_date: '',
  assign_type: '',
  assigned_customer_id: '',
  assigned_employee_id: '',
  assigned_equipment_id: '',
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [customers, setCustomers] = useState<AssignTarget[]>([])
  const [employees, setEmployees] = useState<AssignTarget[]>([])
  const [equipmentList, setEquipmentList] = useState<AssignTarget[]>([])

  const load = useCallback(async () => {
    const [todosRes, customersRes, employeesRes, equipRes] = await Promise.all([
      fetch('/api/todos'),
      fetch('/api/customers'),
      fetch('/api/employees'),
      fetch('/api/equipment'),
    ])
    setTodos(await todosRes.json())
    setCustomers(await customersRes.json())
    setEmployees(await employeesRes.json())
    setEquipmentList(await equipRes.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(t: Todo) {
    setEditing(t)
    setForm({
      title: t.title,
      description: t.description ?? '',
      priority: t.priority,
      due_date: t.due_date ?? '',
      assign_type: t.assign_type ?? '',
      assigned_customer_id: t.assigned_customer_id ?? '',
      assigned_employee_id: t.assigned_employee_id ?? '',
      assigned_equipment_id: t.assigned_equipment_id ?? '',
    })
    setFormOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) return toast.error('Title is required')
    setSaving(true)

    const payload: Record<string, string | null> = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      due_date: form.due_date || null,
      assign_type: form.assign_type || null,
      assigned_customer_id: form.assign_type === 'customer' ? form.assigned_customer_id || null : null,
      assigned_employee_id: form.assign_type === 'employee' ? form.assigned_employee_id || null : null,
      assigned_equipment_id: form.assign_type === 'equipment' ? form.assigned_equipment_id || null : null,
    }

    const url = editing ? `/api/todos/${editing.id}` : '/api/todos'
    const method = editing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const { error } = await res.json()
      toast.error(error)
    } else {
      toast.success(editing ? 'Todo updated' : 'Todo added')
      setFormOpen(false)
      load()
    }
    setSaving(false)
  }

  async function toggleDone(todo: Todo) {
    const newStatus = todo.status === 'done' ? 'pending' : 'done'
    const res = await fetch(`/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, status: newStatus } : t))
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTodos((prev) => prev.filter((t) => t.id !== id))
      toast.success('Todo deleted')
    }
  }

  function getAssignLabel(todo: Todo) {
    if (!todo.assign_type) return null
    if (todo.assign_type === 'customer') return todo.customer?.full_name
    if (todo.assign_type === 'employee') return todo.employee?.full_name
    if (todo.assign_type === 'equipment') return todo.equipment?.name
    return null
  }

  const filtered = todos.filter((t) => filter === 'all' ? true : t.status === filter)
  const pendingCount = todos.filter((t) => t.status === 'pending').length

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-y-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Todo List</h1>
          <p className="text-sm text-zinc-500 mt-1">{pendingCount} pending</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} className="mr-1" />Add Todo</Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-zinc-100 rounded-lg p-1 w-fit">
        {(['pending', 'all', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
              filter === f ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-zinc-200">
              <Skeleton className="w-5 h-5 rounded-full" />
              <Skeleton className="h-4 w-64" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 bg-white rounded-xl border border-zinc-200">
            {filter === 'pending' ? "No pending todos — you're all caught up!" : 'No todos here.'}
          </div>
        ) : (
          filtered.map((todo) => {
            const assignLabel = getAssignLabel(todo)
            return (
              <div
                key={todo.id}
                className={cn(
                  'flex items-start gap-3 p-4 bg-white rounded-xl border transition-colors',
                  todo.status === 'done' ? 'border-zinc-100 opacity-60' : 'border-zinc-200'
                )}
              >
                <button
                  onClick={() => toggleDone(todo)}
                  className="mt-0.5 shrink-0 text-zinc-400 hover:text-green-500 transition-colors"
                >
                  {todo.status === 'done'
                    ? <CheckCircle2 size={20} className="text-green-500" />
                    : <Circle size={20} />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={cn('font-medium text-zinc-900', todo.status === 'done' && 'line-through text-zinc-400')}>
                    {todo.title}
                  </p>
                  {todo.description && (
                    <p className="text-sm text-zinc-500 mt-0.5 truncate">{todo.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge className={cn('text-xs font-normal border-0', PRIORITY_COLORS[todo.priority])}>
                      {todo.priority}
                    </Badge>
                    {assignLabel && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {todo.assign_type === 'customer' && '👤 '}
                        {todo.assign_type === 'employee' && '🪪 '}
                        {todo.assign_type === 'equipment' && '🔧 '}
                        {assignLabel}
                      </Badge>
                    )}
                    {todo.due_date && (
                      <Badge variant="outline" className="text-xs font-normal text-zinc-500">
                        Due {new Date(todo.due_date + 'T00:00:00').toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(todo)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-md hover:bg-zinc-100 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(todo.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 rounded-md hover:bg-zinc-100 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Todo' : 'Add Todo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What needs to be done?"
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Optional details…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v ?? 'normal' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Assign To</Label>
              <Select
                value={form.assign_type || 'none'}
                onValueChange={(v) => setForm({ ...form, assign_type: (v ?? '') === 'none' ? '' : (v ?? ''), assigned_customer_id: '', assigned_employee_id: '', assigned_equipment_id: '' })}
              >
                <SelectTrigger><SelectValue placeholder="— none —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— none —</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.assign_type === 'customer' && (
              <div className="space-y-1">
                <Label>Customer</Label>
                <Select value={form.assigned_customer_id} onValueChange={(v) => setForm({ ...form, assigned_customer_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.assign_type === 'employee' && (
              <div className="space-y-1">
                <Label>Employee</Label>
                <Select value={form.assigned_employee_id} onValueChange={(v) => setForm({ ...form, assigned_employee_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.assign_type === 'equipment' && (
              <div className="space-y-1">
                <Label>Equipment</Label>
                <Select value={form.assigned_equipment_id} onValueChange={(v) => setForm({ ...form, assigned_equipment_id: v ?? '' })}>
                  <SelectTrigger><SelectValue placeholder="Select equipment…" /></SelectTrigger>
                  <SelectContent>
                    {equipmentList.map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
