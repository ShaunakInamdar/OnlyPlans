/**
 * VoiceButton
 *
 * A floating microphone button accessible on all screens.
 * Uses the browser's Web Speech API for speech-to-text transcription,
 * then sends the result as a user message via MessagesContext.addMessage().
 *
 * ─── Voice-to-text (browser-native) ──────────────────────────────────────────
 * No backend call is needed for transcription — the browser handles it via
 * the Web Speech API (SpeechRecognition). Only the final text is sent to the API.
 *
 * Browser support: Chrome, Safari (webkit prefix), Edge.
 * Firefox does not support SpeechRecognition — falls back to text input.
 *
 * ─── On send ─────────────────────────────────────────────────────────────────
 * Calls: addMessage(transcript)  ← from MessagesContext
 * API:   POST /rest/v1/messages  { type: 'user', kind: 'text', text: transcript }
 *
 * The agent processes the message and responds via the real-time subscription
 * in MessagesContext (subscribeToMessages).
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, X, Send as SendIcon } from 'lucide-react'
import { useMessages } from '../context/MessagesContext'

export default function VoiceButton() {
  // addMessage from context — same function ChatScreen uses for typed messages.
  // Calling it here makes the sent message appear in ChatScreen instantly.
  const { addMessage } = useMessages()

  const [listening,   setListening]   = useState(false)
  const [transcript,  setTranscript]  = useState('')
  const [error,       setError]       = useState('')   // mic permission or API error
  const [supported,   setSupported]   = useState(false)
  const [sending,     setSending]     = useState(false)
  const [open,        setOpen]        = useState(false) // overlay visible
  // Use a ref so toggle() always reads the latest recognition instance
  const recognitionRef = useRef(null)

  // ── Initialise SpeechRecognition on mount ───────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      // No speech API — we still show the button; it opens a text-input fallback
      setOpen(false)
      return
    }
    setSupported(true)

    const rec = new SpeechRecognition()
    rec.continuous     = false  // stop after first pause — more reliable cross-browser
    rec.interimResults = true
    rec.lang           = 'en-US'

    rec.onstart = () => {
      setError('')
      setListening(true)
    }

    rec.onresult = (e) => {
      // Concatenate all result segments into one string
      const t = Array.from(e.results).map((r) => r[0].transcript).join('')
      setTranscript(t)
    }

    // onerror fires for permission denied, network errors, no-speech, etc.
    rec.onerror = (e) => {
      setListening(false)
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access denied. Please allow mic access in your browser and try again.')
      } else if (e.error === 'no-speech') {
        setError('No speech detected. Try again.')
      } else {
        setError(`Could not start microphone (${e.error}). Try typing instead.`)
      }
    }

    rec.onend = () => {
      setListening(false)
      // Don't close overlay — keep it open so user can review transcript and send
    }

    recognitionRef.current = rec
  }, [])

  // ── Toggle recording ────────────────────────────────────────────────────────
  const toggle = () => {
    setOpen(true)
    setError('')

    if (!supported) return // fallback: overlay opens in text-input mode

    const rec = recognitionRef.current
    if (!rec) return

    if (listening) {
      rec.stop()
      setListening(false)
    } else {
      setTranscript('')
      try {
        rec.start()
        // onstart will set listening = true once the browser confirms it started
      } catch (err) {
        // recognition.start() throws if already started or not allowed
        setError(`Could not start microphone: ${err.message}. Try typing instead.`)
      }
    }
  }

  // ── Send the transcribed (or typed fallback) text ───────────────────────────
  // API: POST /rest/v1/messages  { type: 'user', kind: 'text', text }
  // addMessage() is from MessagesContext — updates the shared message list
  // so ChatScreen re-renders with the new message instantly.
  const handleSend = async () => {
    const text = transcript.trim()
    if (!text || sending) return
    if (listening) recognitionRef.current?.stop()
    setSending(true)
    setListening(false)
    try {
      await addMessage(text)
      setTranscript('')
      setOpen(false)
    } catch (err) {
      setError('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const dismiss = () => {
    if (listening) recognitionRef.current?.stop()
    setListening(false)
    setTranscript('')
    setError('')
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Show overlay when open (either recording or after recording)
  const showOverlay = open

  return (
    <>
      {/* ── Transcript / fallback overlay ─────────────────────────────────── */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-28 left-4 right-4 z-50 rounded-2xl p-4 shadow-lg border"
            style={{ background: '#FEFCF8', borderColor: '#D0BFA5' }}
            // Stop pointer events bubbling to the swipe handler in App.jsx
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-xs font-medium" style={{ color: '#B12A42' }}>
                {listening ? 'Listening…' : supported ? 'Review & send' : 'Type your message'}
              </p>
              <button onClick={dismiss} style={{ color: '#6B7A7F' }}>
                <X size={16} />
              </button>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-xs mb-2 p-2 rounded-lg" style={{ background: '#FDECEA', color: '#B12A42' }}>
                {error}
              </p>
            )}

            {/* Transcript display (if speech is supported) or text input fallback */}
            {supported && !error ? (
              <p className="text-sm min-h-[40px] mb-3" style={{ color: transcript ? '#1A1A1A' : '#6B7A7F' }}>
                {transcript || (listening ? 'Start speaking…' : 'Tap mic to record again')}
              </p>
            ) : (
              /* Text input fallback — shown when speech is unsupported or errored */
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message here…"
                rows={2}
                className="w-full text-sm rounded-xl px-3 py-2 mb-3 outline-none resize-none border"
                style={{ background: '#EDE3D0', borderColor: '#D0BFA5', color: '#1A1A1A' }}
                autoFocus
              />
            )}

            {/* Action row: re-record + send */}
            <div className="flex gap-2">
              {supported && (
                <button
                  onClick={toggle}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border"
                  style={{
                    background: listening ? '#023544' : '#EDE3D0',
                    color:      listening ? '#fff'    : '#023544',
                    borderColor: '#D0BFA5',
                  }}
                >
                  {listening ? <MicOff size={13} /> : <Mic size={13} />}
                  {listening ? 'Stop' : 'Re-record'}
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!transcript.trim() || sending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-medium transition-opacity"
                style={{ background: '#B12A42', opacity: (!transcript.trim() || sending) ? 0.45 : 1 }}
              >
                <SendIcon size={13} />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating mic button ────────────────────────────────────────────── */}
      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.9 }}
        className="absolute bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center"
        style={{ background: listening ? '#023544' : '#B12A42' }}
        aria-label={listening ? 'Stop recording' : 'Start voice input'}
      >
        {listening ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <MicOff size={22} color="white" />
          </motion.div>
        ) : (
          <Mic size={22} color="white" />
        )}
      </motion.button>
    </>
  )
}
