/**
 * ChatScreen
 *
 * The main screen. Shows the full conversation history between the user and
 * the AI agent — both text messages and call records.
 *
 * ─── Data ─────────────────────────────────────────────────────────────────────
 * Messages come from MessagesContext (src/context/MessagesContext.jsx).
 * The context owns loading, the message list, and the addMessage function.
 * Both this screen and VoiceButton share the same context instance, so a
 * voice-sent message appears here instantly with no event bus needed.
 *
 * ─── API calls made ───────────────────────────────────────────────────────────
 * GET  /rest/v1/messages?user_id=eq.{id}&select=*,calls(*)&order=created_at.asc
 * POST /rest/v1/messages  { type: 'user', kind: 'text', text }
 */
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Phone, Send } from 'lucide-react'
import { useMessages } from '../context/MessagesContext'

// ─── Call status display config ───────────────────────────────────────────────
// Maps user_status from the calls table to a badge label + colours.
// user_status values: 'inprogress' | 'notstarted' | 'cantfinish'
const callStatusConfig = {
  inprogress:  { text: 'In progress',      bg: '#F5E0C8', color: '#7A3B10' },
  notstarted:  { text: 'Not started',      bg: '#E8D8C3', color: '#6B7A7F' },
  cantfinish:  { text: "Couldn't finish",  bg: '#FDECEA', color: '#B12A42' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A single chat bubble.
 * type = 'user' → right-aligned, burgundy background
 * type = 'agent' → left-aligned, warm cream background
 */
function TextBubble({ msg }) {
  const isAgent = msg.type === 'agent'
  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
      {isAgent && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 shrink-0"
          style={{ background: '#0D3C4B' }}
        >
          A
        </div>
      )}
      <div
        className="max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
        style={
          isAgent
            ? { background: '#EDE3D0', color: '#1A1A1A', borderTopLeftRadius: 4 }
            : { background: '#B12A42', color: '#fff', borderTopRightRadius: 4 }
        }
      >
        {msg.text}
      </div>
    </div>
  )
}

/**
 * A call record card.
 * Rendered when msg.kind === 'call'.
 *
 * Displays:
 *   - "Only Plans called you" header + duration
 *   - user_status badge (what the user reported on the call)
 *   - task the call was about (msg.task — denormalised from tasks table)
 *   - summary of the call
 *   - followUp action the agent took
 */
function CallCard({ msg }) {
  const status = callStatusConfig[msg.user_status]
  return (
    <div className="flex justify-center">
      <div
        className="rounded-2xl p-4 max-w-[85%] w-full shadow-sm border"
        style={{ background: '#F5EFE3', borderColor: '#D0BFA5' }}
      >
        {/* Header: icon + title + status badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: '#E8D8C3' }}
            >
              <Phone size={13} style={{ color: '#B12A42' }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#023544' }}>Only Plans called you</p>
              <p className="text-xs" style={{ color: '#6B7A7F' }}>{msg.duration}</p>
            </div>
          </div>
          {status && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
              style={{ background: status.bg, color: status.color }}
            >
              {status.text}
            </span>
          )}
        </div>

        {/* Task reference — msg.task is denormalised title from tasks table */}
        {msg.task && (
          <p className="text-xs font-medium mb-1.5" style={{ color: '#023544' }}>
            re: {msg.task}
          </p>
        )}

        {/* Call summary — written by the AI agent after the call */}
        <p className="text-xs leading-relaxed" style={{ color: '#6B7A7F' }}>{msg.summary}</p>

        {/* Follow-up action — e.g. rescheduled task, sent text */}
        {msg.followUp && (
          <p
            className="text-xs mt-2.5 pt-2 border-t"
            style={{ color: '#B12A42', borderColor: '#E8D8C3' }}
          >
            → {msg.followUp}
          </p>
        )}
      </div>
    </div>
  )
}

/** Date separator between message groups */
function DateLabel({ label }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="flex-1 h-px" style={{ background: '#D0BFA5' }} />
      <span className="text-xs font-medium" style={{ color: '#6B7A7F' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: '#D0BFA5' }} />
    </div>
  )
}

/** Skeleton placeholder shown while messages are loading */
function MessageSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4">
      {[80, 60, 90, 55, 70].map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <div
            className="h-9 rounded-2xl animate-pulse"
            style={{ width: `${w}%`, background: '#E8D8C3' }}
          />
        </div>
      ))}
    </div>
  )
}

// ─── ChatScreen ───────────────────────────────────────────────────────────────

export default function ChatScreen() {
  // messages + loading come from MessagesContext — shared with VoiceButton.
  // addMessage sends to the API and appends to the shared list.
  const { messages, loading, addMessage } = useMessages()

  const [input, setInput]     = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  // ── Scroll to bottom whenever messages change ───────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send a user message ─────────────────────────────────────────────────────
  // API: POST /rest/v1/messages { type:'user', kind:'text', text }
  // addMessage() handles both the API call and updating the shared message list.
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    try {
      await addMessage(text)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Group messages by date for section headers ─────────────────────────────
  const grouped = []
  let lastDate = null
  messages.forEach((msg) => {
    if (msg.date !== lastDate) {
      grouped.push({ type: 'date', label: msg.date, id: `date-${msg.date}` })
      lastDate = msg.date
    }
    grouped.push(msg)
  })

  return (
    <div className="flex flex-col h-dvh" style={{ background: '#F9F4E8' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {/* Displays agent identity. In production, fetch agent name/avatar from user profile. */}
      <div className="pt-10 pb-3 px-4 border-b shrink-0" style={{ background: '#F5EFE3', borderColor: '#D0BFA5' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ background: '#0D3C4B' }}
          >
            A
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#023544' }}>Your AI Agent</p>
            <p className="text-xs font-medium" style={{ color: '#2A9D6B' }}>● Active</p>
          </div>
        </div>
      </div>

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <MessageSkeleton />
        ) : (
          grouped.map((item) => {
            if (item.type === 'date') return <DateLabel key={item.id} label={item.label} />
            if (item.kind === 'call')  return <CallCard  key={item.id} msg={item} />
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <TextBubble msg={item} />
                <p
                  className={`text-xs mt-1 ${item.type === 'user' ? 'text-right' : 'ml-9'}`}
                  style={{ color: '#6B7A7F' }}
                >
                  {item.time}
                </p>
              </motion.div>
            )
          })
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      {/*
        On send:    POST /rest/v1/messages { type:'user', kind:'text', text }
        Voice text: VoiceButton calls addMessage() from the same MessagesContext,
                    so sent voice messages appear here automatically.
      */}
      <div className="shrink-0 border-t px-4 py-3 pb-8" style={{ background: '#F5EFE3', borderColor: '#D0BFA5' }}>
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5 pr-2"
          style={{ background: '#EDE3D0' }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your agent…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: '#1A1A1A' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ background: input.trim() ? '#B12A42' : '#D0BFA5' }}
          >
            <Send size={14} color="white" />
          </button>
        </div>
      </div>
    </div>
  )
}
