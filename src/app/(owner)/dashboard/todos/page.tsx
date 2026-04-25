'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { CheckCircle2, Circle, Trash2, Plus, Calendar } from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  trigger_type: string
  trigger_date: string | null
  status: 'pending' | 'done' | 'cancelled'
  created_at: string
}

const EMPTY_FORM = { title: '', description: '', trigger_date: '', trigger_type: 'once' }

export default function TodosPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'done'>('pending')
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/tasks')
    if (res.ok) {
      const all: Task[] = await res.json()
      setTasks(all.filter((t) => t.status === filter))
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!form.title.trim()) return toast.error('Title is required')
    setSaving(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        description: form.description.trim() || null,
        trigger_type: form.trigger_type,
        trigger_date: form.trigger_date || null,
        status: 'pending',
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Task added')
      setAddOpen(false)
      setForm(EMPTY_FORM)
      load()
    } else {
      toast.error('Failed to add task')
    }
  }

  async function handleComplete(id: string) {
    setCompleting(id)
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'done' }),
    })
    setCompleting(null)
    load()
  }

  async function handleDelete(id: string) {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'cancelled' }),
    })
    load()
  }

  const pendingCount = tasks.length

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">To-Do</h1>
          <p className="text-sm text-zinc-500 mt-1">Tasks, reminders, and follow-ups</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} className="mr-1.5" /> Add Task
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-zinc-200">
        {(['pending', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              filter === f ? 'border-zinc-900 text-zinc-900' : 'border-transparent text-zinc-400 hover:text-zinc-600'
            }`}
          >
            {f === 'pending' ? `Open${pendingCount && filter === 'pending' ? ` (${pendingCount})` : ''}` : 'Completed'}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          {filter === 'pending' ? (
            <>
              <CheckCircle2 size={40} className="mx-auto mb-3 text-zinc-200" />
              <p className="font-medium text-zinc-500">All caught up!</p>
              <p className="text-sm mt-1">No open tasks. Add one to get started.</p>
            </>
          ) : (
            <>
              <Circle size={40} className="mx-auto mb-3 text-zinc-200" />
              <p className="text-sm">No completed tasks yet.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="bg-white border border-zinc-200 rounded-xl px-4 py-3.5 flex items-start gap-3 shadow-sm hover:shadow transition-shadow"
            >
              {/* Complete button */}
              {filter === 'pending' && (
                <button
                  onClick={() => handleComplete(task.id)}
                  disabled={completing === task.id}
                  className="mt-0.5 shrink-0 text-zinc-300 hover:text-green-500 transition-colors disabled:opacity-50"
                  title="Mark done"
                >
                  <Circle size={20} />
                </button>
              )}
              {filter === 'done' && (
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-green-500" />
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${filter === 'done' ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-zinc-500 mt-0.5">{task.description}</p>
                )}
                {task.trigger_date && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-zinc-400">
                    <Calendar size={11} />
                    {format(new Date(task.trigger_date + 'T12:00:00'), 'MMM d, yyyy')}
                  </div>
                )}
              </div>

              {/* Delete */}
              {filter === 'pending' && (
                <button
                  onClick={() => handleDelete(task.id)}
                  className="shrink-0 text-zinc-200 hover:text-red-400 transition-colors mt-0.5"
                  title="Remove"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add task dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700">Title *</label>
              <Input
                placeholder="e.g. Call John about spring cleanup"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700">Details <span className="font-normal text-zinc-400">(optional)</span></label>
              <Input
                placeholder="Any extra notes"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-zinc-700">Due date <span className="font-normal text-zinc-400">(optional)</span></label>
              <Input
                type="date"
                value={form.trigger_date}
                onChange={(e) => setForm({ ...form, trigger_date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving}>{saving ? 'Adding…' : 'Add Task'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
