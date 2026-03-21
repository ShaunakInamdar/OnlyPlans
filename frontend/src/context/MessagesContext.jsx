/**
 * MessagesContext
 *
 * Provides the chat message list and an `addMessage` function to any
 * component in the tree — without prop drilling.
 *
 * Why context instead of a message bus or window events:
 *   VoiceButton lives in App.jsx (outside ChatScreen) so it can float over
 *   every screen. It needs to push messages into the same list that
 *   ChatScreen renders. React Context is the idiomatic solution: the provider
 *   owns the state, both components read from / write to it.
 *
 * ─── Backend integration note ─────────────────────────────────────────────────
 * When Supabase is connected:
 *   - `loadMessages` calls GET /rest/v1/messages (replace mock in useEffect)
 *   - `addMessage`   calls POST /rest/v1/messages (replace mock sendMessage)
 *   - The Supabase Realtime subscription (postgres_changes INSERT on messages)
 *     should also call addMessage so agent replies appear in real time.
 *
 * ─── Data shape ───────────────────────────────────────────────────────────────
 * Message (text): { id, user_id, type:'user'|'agent', kind:'text', text,
 *                   created_at, date, time }
 * Message (call): { id, user_id, type:'call', kind:'call', created_at, date,
 *                   time, call_id, duration, task_id, task, user_status,
 *                   summary, followUp }
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getMessages, sendMessage, subscribeToMessages } from '../api/services/messages'
import { supabase, getUserId } from '../api/supabase'

// ─── Context ──────────────────────────────────────────────────────────────────

const MessagesContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MessagesProvider({ children }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)

  // Load history on mount
  // API: GET /rest/v1/messages?user_id=eq.{id}&select=*,calls(*)&order=created_at.asc
  useEffect(() => {
    getMessages()
      .then(({ messages }) => setMessages(messages))
      .finally(() => setLoading(false))
  }, [])

  // Real-time subscription — agent replies and incoming call records
  // API: Supabase Realtime postgres_changes on messages table
  useEffect(() => {
    const unsubscribe = subscribeToMessages(supabase, getUserId(), (newMsg) => {
      setMessages((prev) => [...prev, newMsg])
    })
    return unsubscribe
  }, [])

  /**
   * Send a text message and immediately add it to the local list.
   * Called by both the ChatScreen text input and the VoiceButton.
   *
   * API: POST /rest/v1/messages { type:'user', kind:'text', text }
   * Returns the saved Message object (mock or real).
   *
   * @param {string} text
   * @returns {Promise<void>}
   */
  const addMessage = useCallback(async (text) => {
    const { message } = await sendMessage(text)
    setMessages((prev) => [...prev, message])
  }, [])

  return (
    <MessagesContext.Provider value={{ messages, loading, addMessage }}>
      {children}
    </MessagesContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMessages() {
  const ctx = useContext(MessagesContext)
  if (!ctx) throw new Error('useMessages must be used inside <MessagesProvider>')
  return ctx
}
