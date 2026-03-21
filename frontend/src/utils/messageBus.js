/**
 * messageBus — lightweight pub/sub for cross-component messaging.
 *
 * Used to let VoiceButton (rendered in App.jsx) notify ChatScreen about
 * new messages without prop-drilling or a global state manager.
 *
 * Both components import this same module instance, so the listener
 * registered by ChatScreen is guaranteed to be the same one that
 * VoiceButton calls into — no window event serialisation, no timing races.
 *
 * When a real backend (Supabase Realtime) is connected, VoiceButton can
 * stop calling emit() entirely — the realtime subscription in ChatScreen
 * will handle all incoming messages automatically.
 *
 * Usage:
 *   // publisher (VoiceButton)
 *   import { emit } from '../utils/messageBus'
 *   emit('voiceMessage', message)
 *
 *   // subscriber (ChatScreen)
 *   import { on } from '../utils/messageBus'
 *   useEffect(() => on('voiceMessage', (msg) => setMessages(p => [...p, msg])), [])
 */

const _listeners = {}

/**
 * Subscribe to an event. Returns an unsubscribe function for use in
 * useEffect cleanup.
 *
 * @param {string}   event   - event name, e.g. 'voiceMessage'
 * @param {function} fn      - called with the emitted payload
 * @returns {function}         unsubscribe
 */
export function on(event, fn) {
  _listeners[event] = [...(_listeners[event] || []), fn]
  return () => {
    _listeners[event] = (_listeners[event] || []).filter((f) => f !== fn)
  }
}

/**
 * Emit an event to all current subscribers.
 *
 * @param {string} event   - event name
 * @param {*}      payload - data passed to each subscriber
 */
export function emit(event, payload) {
  ;(_listeners[event] || []).forEach((fn) => fn(payload))
}
