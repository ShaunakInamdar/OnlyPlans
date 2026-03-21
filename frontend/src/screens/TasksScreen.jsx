/**
 * TasksScreen
 *
 * Lists all tasks sorted by due date. Tapping a task opens a detail panel
 * showing the personal "why", agent notes, and checkable subtasks.
 *
 * ─── Data ─────────────────────────────────────────────────────────────────────
 * Loaded via:  getTasks()       → src/api/services/tasks.js
 * Updated via: updateTask()     → marks a task complete
 *              toggleSubtask()  → checks/unchecks a subtask step
 *
 * ─── API calls made ───────────────────────────────────────────────────────────
 * GET   /rest/v1/tasks?user_id=eq.{id}&select=*,subtasks(*)&order=due_order.asc
 * PATCH /rest/v1/tasks?id=eq.{taskId}           { status: 'done' }
 * PATCH /rest/v1/subtasks?id=eq.{subtaskId}     { done: !current }
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Clock, ChevronRight, X, CheckSquare, Square } from 'lucide-react'
import { getTasks, updateTask, toggleSubtask } from '../api/services/tasks'

// ─── Status badge config ──────────────────────────────────────────────────────
// Maps task.status to display label + colours.
// status values: 'todo' | 'inprogress' | 'done'
const statusConfig = {
  done:       { label: 'Done',        bg: '#D1F0E2', text: '#1A6645' },
  inprogress: { label: 'In Progress', bg: '#F5E0C8', text: '#7A3B10' },
  todo:       { label: 'To Do',       bg: '#E8D8C3', text: '#6B7A7F' },
}

// ─── Date section headers ─────────────────────────────────────────────────────
// due_order values come from the tasks table:  0=overdue, 1=today, 2=tomorrow, 3=later
const dueSections = [
  { key: 0, label: 'Overdue'   },
  { key: 1, label: 'Today'     },
  { key: 2, label: 'Tomorrow'  },
  { key: 3, label: 'Later'     },
]

function StatusBadge({ status }) {
  const cfg = statusConfig[status]
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  )
}

/** Skeleton card for loading state */
function TaskSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl px-4 py-4 border animate-pulse"
          style={{ background: '#fff', borderColor: '#D0BFA5', height: 64 }}
        />
      ))}
    </div>
  )
}

// ─── TaskDetail ───────────────────────────────────────────────────────────────

/**
 * Full-screen slide-up panel for a single task.
 *
 * Shows:
 *   - task.why        — the personal motivation set during onboarding
 *   - task.notes      — the agent's contextual note
 *   - task.subtasks[] — checkable step list
 *   - "Mark as Complete" CTA
 *
 * On subtask toggle:
 *   PATCH /rest/v1/subtasks?id=eq.{subtaskId}  { done: !current }
 *
 * On mark complete:
 *   PATCH /rest/v1/tasks?id=eq.{taskId}  { status: 'done' }
 *   Backend trigger then awards XP and checks milestones.
 */
function TaskDetail({ task, onClose, onTaskUpdate }) {
  // Local subtask state — optimistic UI, synced with backend on each toggle
  const [subtasks, setSubtasks] = useState(task.subtasks)
  const [completing, setCompleting] = useState(false)

  // ── Toggle a subtask ────────────────────────────────────────────────────────
  // API: PATCH /rest/v1/subtasks?id=eq.{subtaskId}  { done: !current }
  const handleToggleSubtask = async (subtaskId) => {
    // Optimistic update — flip locally immediately
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s))
    )
    try {
      await toggleSubtask(task.id, subtaskId)
    } catch {
      // Rollback on error
      setSubtasks(task.subtasks)
    }
  }

  // ── Mark task complete ──────────────────────────────────────────────────────
  // API: PATCH /rest/v1/tasks?id=eq.{taskId}  { status: 'done' }
  // Backend: awards XP, updates streak, checks milestones
  const handleComplete = async () => {
    setCompleting(true)
    try {
      const { task: updated } = await updateTask(task.id, { status: 'done' })
      onTaskUpdate(updated)
      onClose()
    } finally {
      setCompleting(false)
    }
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      className="absolute inset-0 z-40 flex flex-col"
      style={{ background: '#F9F4E8' }}
    >
      {/* Header */}
      <div className="pt-10 pb-4 px-4 border-b flex items-start justify-between"
        style={{ background: '#F5EFE3', borderColor: '#D0BFA5' }}>
        <div className="flex-1 pr-4">
          <StatusBadge status={task.status} />
          <h2 className="text-base font-semibold mt-2" style={{ color: '#023544' }}>{task.title}</h2>
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#6B7A7F' }}>
            <Clock size={11} /> {task.due}
            <span className="ml-2 opacity-60">· {task.goal}</span>
          </p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: '#E8D8C3' }}>
          <X size={16} style={{ color: '#6B7A7F' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* Why this matters — task.why, set during onboarding call */}
        {task.why && (
          <div className="rounded-2xl p-4 border" style={{ background: '#fff', borderColor: '#D0BFA5' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#6B7A7F' }}>Why this matters to you</p>
            <p className="text-sm leading-relaxed font-medium" style={{ color: '#023544' }}>"{task.why}"</p>
          </div>
        )}

        {/* Agent's note — task.notes, written by the AI after each call */}
        {task.notes && (
          <div className="rounded-2xl p-4 border" style={{ background: '#EDE3D0', borderColor: '#D0BFA5' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#B12A42' }}>Agent's note</p>
            <p className="text-sm leading-relaxed" style={{ color: '#1A1A1A' }}>{task.notes}</p>
          </div>
        )}

        {/* Subtasks — task.subtasks[], from subtasks table */}
        {subtasks.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#6B7A7F' }}>Steps</p>
            <div className="space-y-2">
              {subtasks.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleToggleSubtask(s.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left border"
                  style={{ background: '#fff', borderColor: '#D0BFA5' }}
                >
                  {s.done
                    ? <CheckSquare size={18} className="shrink-0" style={{ color: '#B12A42' }} />
                    : <Square size={18} className="shrink-0" style={{ color: '#D0BFA5' }} />}
                  <span className="text-sm"
                    style={{ color: s.done ? '#6B7A7F' : '#1A1A1A', textDecoration: s.done ? 'line-through' : 'none' }}>
                    {s.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mark complete CTA — only shown for non-done tasks */}
      {task.status !== 'done' && (
        <div className="px-4 pb-8 pt-3 border-t" style={{ borderColor: '#D0BFA5' }}>
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-opacity"
            style={{ background: '#B12A42', opacity: completing ? 0.6 : 1 }}
          >
            {completing ? 'Saving…' : 'Mark as Complete'}
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── TasksScreen ──────────────────────────────────────────────────────────────

export default function TasksScreen() {
  // tasks: Task[] — all tasks for the user, sorted by due_order
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  // toggling: Set of task IDs currently being saved — prevents double-tap
  const [toggling, setToggling] = useState(new Set())

  // ── Load tasks on mount ─────────────────────────────────────────────────────
  // API: GET /rest/v1/tasks?user_id=eq.{id}&select=*,subtasks(*)&order=due_order.asc
  useEffect(() => {
    getTasks()
      .then(({ tasks }) => setTasks(tasks))
      .finally(() => setLoading(false))
  }, [])

  // ── Receive updated task from detail panel ──────────────────────────────────
  const handleTaskUpdate = (updatedTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)))
  }

  // ── Toggle task done/todo directly from the circle button ───────────────────
  // API: PATCH /rest/v1/tasks?id=eq.{taskId}  { status: 'done' | 'todo' }
  // Uses optimistic UI: flips locally first, rolls back on error.
  const handleCircleToggle = async (e, task) => {
    e.stopPropagation() // don't open detail panel
    if (toggling.has(task.id)) return

    const newStatus = task.status === 'done' ? 'todo' : 'done'

    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)))
    setToggling((prev) => new Set(prev).add(task.id))

    try {
      const { task: updated } = await updateTask(task.id, { status: newStatus })
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      // Rollback on error
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)))
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(task.id); return s })
    }
  }

  // ── Group tasks by due_order ────────────────────────────────────────────────
  const grouped = dueSections
    .map((section) => ({ ...section, tasks: tasks.filter((t) => t.due_order === section.key) }))
    .filter((section) => section.tasks.length > 0)

  const total = tasks.length
  const done  = tasks.filter((t) => t.status === 'done').length

  return (
    <div className="relative flex flex-col h-dvh" style={{ background: '#F9F4E8' }}>

      {/* Header */}
      <div className="pt-10 pb-3 px-4 border-b shrink-0"
        style={{ background: '#F5EFE3', borderColor: '#D0BFA5' }}>
        <h1 className="text-lg font-bold" style={{ color: '#023544' }}>My Tasks</h1>
        <p className="text-xs mt-0.5" style={{ color: '#6B7A7F' }}>
          {done} of {total} tasks done this week
        </p>
      </div>

      {/* Task list — grouped by due_order */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {loading ? (
          <TaskSkeleton />
        ) : (
          grouped.map((section) => (
            <div key={section.key}>
              {/* Section header — 'Overdue' shown in red as a warning */}
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: section.key === 0 ? '#B12A42' : '#6B7A7F' }}>
                  {section.label}
                </p>
                <div className="flex-1 h-px" style={{ background: '#D0BFA5' }} />
              </div>

              <div className="space-y-2">
                {section.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="w-full rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm border"
                    style={{ background: '#fff', borderColor: '#D0BFA5' }}
                  >
                    {/*
                      ── Checkable circle ────────────────────────────────────
                      Tapping this circle directly marks the task done/todo.
                      API: PATCH /rest/v1/tasks?id=eq.{taskId} { status: '...' }
                      Does NOT open the detail panel.
                    */}
                    <button
                      onClick={(e) => handleCircleToggle(e, task)}
                      disabled={toggling.has(task.id)}
                      className="shrink-0 transition-transform active:scale-90"
                      aria-label={task.status === 'done' ? 'Mark as to-do' : 'Mark as done'}
                    >
                      {task.status === 'done'
                        ? <CheckCircle2 size={22} style={{ color: '#2A9D6B' }} />
                        : <Circle size={22} style={{ color: '#D0BFA5' }} />}
                    </button>

                    {/* Row content — tapping here opens the detail panel */}
                    <button
                      onClick={() => setSelected(task)}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left active:scale-[0.98] transition-transform"
                    >
                      <div className="flex-1 min-w-0">
                        {/* task.title — from tasks table */}
                        <p className="text-sm font-medium truncate"
                          style={{
                            color: task.status === 'done' ? '#6B7A7F' : '#023544',
                            textDecoration: task.status === 'done' ? 'line-through' : 'none',
                          }}>
                          {task.title}
                        </p>
                        {/* task.due + task.goal — due is a human label; goal is the category */}
                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#6B7A7F' }}>
                          <Clock size={10} /> {task.due}
                          <span className="opacity-60">· {task.goal}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={task.status} />
                        <ChevronRight size={15} style={{ color: '#D0BFA5' }} />
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <div className="h-20" />
      </div>

      {/* Task detail panel — slides up from bottom */}
      <AnimatePresence>
        {selected && (
          <TaskDetail
            task={selected}
            onClose={() => setSelected(null)}
            onTaskUpdate={handleTaskUpdate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
