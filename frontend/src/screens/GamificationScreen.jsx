/**
 * GamificationScreen
 *
 * Shows the user's XP progress, streak, weekly performance, and milestones.
 *
 * ─── Data ─────────────────────────────────────────────────────────────────────
 * Loaded via: getStats() → src/api/services/stats.js
 *
 * ─── API calls made ───────────────────────────────────────────────────────────
 * GET /rest/v1/user_stats?user_id=eq.{id}&select=*
 *
 * Stats are recalculated on the backend whenever a task is marked complete.
 * For real-time updates, subscribe to the user_stats table via Supabase Realtime.
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Flame, Star, Trophy, Lock, CheckCircle2 } from 'lucide-react'
import { getStats } from '../api/services/stats'

// ─── ProgressRing ─────────────────────────────────────────────────────────────
/**
 * Animated SVG ring showing XP progress to the next level.
 * value / max comes from stats.points / stats.next_level_points
 */
function ProgressRing({ value, max, size = 100, stroke = 8 }) {
  const r      = (size - stroke) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (value / max) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8D8C3" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#B12A42" strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
/**
 * A small stat tile (streak / XP / completed total).
 * All values come from the stats object returned by getStats().
 */
function StatCard({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <div className="rounded-2xl p-4 flex-1 shadow-sm border" style={{ background: '#fff', borderColor: '#D0BFA5' }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: iconBg }}>
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <p className="text-xl font-bold" style={{ color: '#023544' }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#6B7A7F' }}>{label}</p>
    </div>
  )
}

/** Skeleton shown while stats are loading */
function StatsSkeleton() {
  return (
    <div className="px-4 py-5 space-y-5">
      {[96, 48, 200, 200].map((h, i) => (
        <div key={i} className="rounded-2xl animate-pulse" style={{ height: h, background: '#E8D8C3' }} />
      ))}
    </div>
  )
}

// ─── GamificationScreen ───────────────────────────────────────────────────────

export default function GamificationScreen() {
  // stats: Stats — gamification data for the current user
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)

  // ── Load stats on mount ─────────────────────────────────────────────────────
  // API: GET /rest/v1/user_stats?user_id=eq.{id}&select=*
  // Stats are recomputed by a backend trigger whenever a task is completed.
  useEffect(() => {
    getStats()
      .then(({ stats }) => setStats(stats))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !stats) {
    return (
      <div className="flex flex-col h-dvh" style={{ background: '#F9F4E8' }}>
        <div className="pt-10 pb-4 px-4 border-b" style={{ background: '#F5EFE3', borderColor: '#D0BFA5' }}>
          <div className="h-5 w-32 rounded animate-pulse" style={{ background: '#E8D8C3' }} />
        </div>
        <StatsSkeleton />
      </div>
    )
  }

  // stats.points / stats.next_level_points → XP ring fill percentage
  const xpPercent = Math.round((stats.points / stats.next_level_points) * 100)

  return (
    <div className="flex flex-col h-dvh overflow-y-auto" style={{ background: '#F9F4E8' }}>

      {/* Header */}
      <div className="pt-10 pb-4 px-4 border-b shrink-0"
        style={{ background: '#F5EFE3', borderColor: '#D0BFA5' }}>
        <h1 className="text-lg font-bold" style={{ color: '#023544' }}>Your Progress</h1>
        {/* stats.level_name + stats.level — from user_stats table */}
        <p className="text-xs mt-0.5" style={{ color: '#6B7A7F' }}>
          {stats.level_name} · Level {stats.level}
        </p>
      </div>

      <div className="px-4 py-5 space-y-5 pb-28">

        {/* ── XP ring card ──────────────────────────────────────────────────── */}
        {/* stats.points, stats.next_level_points, stats.level */}
        <div className="rounded-2xl p-5 shadow-sm border flex items-center gap-5"
          style={{ background: '#fff', borderColor: '#D0BFA5' }}>
          <div className="relative shrink-0">
            <ProgressRing value={stats.points} max={stats.next_level_points} size={96} stroke={8} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-bold" style={{ color: '#023544' }}>{xpPercent}%</p>
              <p className="text-[10px]" style={{ color: '#6B7A7F' }}>to Lv.{stats.level + 1}</p>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: '#023544' }}>Level {stats.level}</p>
            <p className="text-xs mt-0.5" style={{ color: '#6B7A7F' }}>{stats.level_name}</p>
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#6B7A7F' }}>
                <span>{stats.points} XP</span>
                <span>{stats.next_level_points} XP</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E8D8C3' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: '#B12A42' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPercent}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Stat cards ────────────────────────────────────────────────────── */}
        {/* stats.streak, stats.points, stats.completed_total */}
        <div className="flex gap-3">
          <StatCard icon={Flame}  label="Day streak" value={`${stats.streak} 🔥`}    iconBg="#FDECEA" iconColor="#B12A42" />
          <StatCard icon={Star}   label="Total XP"   value={stats.points}             iconBg="#FEF3D0" iconColor="#D97706" />
          <StatCard icon={Trophy} label="Completed"  value={stats.completed_total}    iconBg="#D1F0E2" iconColor="#2A9D6B" />
        </div>

        {/* ── Weekly bar chart ──────────────────────────────────────────────── */}
        {/*
          stats.week_days: WeekDay[]
          Each bar height = done / total for that day.
          In production, 'today' is determined by comparing day name to the current weekday.
        */}
        <div className="rounded-2xl p-4 shadow-sm border" style={{ background: '#fff', borderColor: '#D0BFA5' }}>
          <p className="text-sm font-semibold mb-4" style={{ color: '#023544' }}>This Week</p>
          <div className="flex items-end justify-between gap-1.5 h-20">
            {stats.week_days.map((d) => {
              const pct     = d.total === 0 ? 0 : d.done / d.total
              const isToday = d.day === 'Sat' // TODO: compute from new Date().getDay() in production
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    className="w-full rounded-t-lg"
                    style={{ background: isToday ? '#B12A42' : '#E8D8C3' }}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct * 72, d.total === 0 ? 0 : 6)}px` }}
                    transition={{ duration: 0.8, delay: 0.05, ease: 'easeOut' }}
                  />
                  <span className="text-[10px] font-medium"
                    style={{ color: isToday ? '#B12A42' : '#6B7A7F' }}>
                    {d.day}
                  </span>
                </div>
              )
            })}
          </div>
          {/* stats.weekly_done / stats.weekly_goal */}
          <p className="text-xs mt-3 text-center" style={{ color: '#6B7A7F' }}>
            {stats.weekly_done}/{stats.weekly_goal} daily goals hit this week
          </p>
        </div>

        {/* ── Milestones ────────────────────────────────────────────────────── */}
        {/*
          stats.milestones: Milestone[]
          Milestone.unlocked is set by a backend trigger when the condition is met.
          Locked milestones are shown greyed out to provide goal visibility.
        */}
        <div className="rounded-2xl p-4 shadow-sm border" style={{ background: '#fff', borderColor: '#D0BFA5' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#023544' }}>Milestones</p>
          <div className="space-y-2">
            {stats.milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                {m.unlocked
                  ? <CheckCircle2 size={18} className="shrink-0" style={{ color: '#2A9D6B' }} />
                  : <Lock size={18} className="shrink-0" style={{ color: '#D0BFA5' }} />}
                <p className="text-sm" style={{ color: m.unlocked ? '#1A1A1A' : '#6B7A7F' }}>{m.label}</p>
                {m.unlocked && (
                  <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: '#D1F0E2', color: '#1A6645' }}>
                    Earned
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Agent nudge ───────────────────────────────────────────────────── */}
        {/*
          stats.agent_nudge — written by the AI agent, stored in user_stats.
          Updated after each call or task completion based on the user's mindprint
          and current progress (motivation_driver influences the framing).
        */}
        {stats.agent_nudge && (
          <div className="rounded-2xl p-4 border" style={{ background: '#EDE3D0', borderColor: '#D0BFA5' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#B12A42' }}>Agent says</p>
            <p className="text-sm leading-relaxed" style={{ color: '#1A1A1A' }}>{stats.agent_nudge}</p>
          </div>
        )}
      </div>
    </div>
  )
}
