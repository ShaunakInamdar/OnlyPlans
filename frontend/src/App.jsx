import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ChatScreen from './screens/ChatScreen'
import TasksScreen from './screens/TasksScreen'
import GamificationScreen from './screens/GamificationScreen'
import VoiceButton from './components/VoiceButton'
import { MessagesProvider } from './context/MessagesContext'

// Swipe left  → Tasks
// Center      → Chat
// Swipe right → Gamification
const SCREENS = ['tasks', 'chat', 'gamification']

export default function App() {
  const [screenIndex, setScreenIndex] = useState(1)
  const [direction, setDirection] = useState(0)
  const pointerStart = useRef(null)

  const goTo = (i) => {
    setDirection(i > screenIndex ? 1 : -1)
    setScreenIndex(i)
  }

  const onPointerDown = (e) => {
    pointerStart.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e) => {
    if (!pointerStart.current) return
    const dx = e.clientX - pointerStart.current.x
    const dy = e.clientY - pointerStart.current.y
    pointerStart.current = null

    // Ignore if movement is too small or mostly vertical (user is scrolling)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return

    if (dx < 0 && screenIndex < SCREENS.length - 1) goTo(screenIndex + 1)
    else if (dx > 0 && screenIndex > 0) goTo(screenIndex - 1)
  }

  const screen = SCREENS[screenIndex]

  return (
    // MessagesProvider owns the message list + addMessage function.
    // Both ChatScreen (displays messages) and VoiceButton (sends messages)
    // consume it via useMessages() — no prop drilling, no event bus needed.
    <MessagesProvider>
    <div
      className="relative w-full h-dvh overflow-hidden select-none"
      style={{ background: '#F9F4E8' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Screen dots */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex gap-1.5 items-center">
        {SCREENS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              background: i === screenIndex ? '#B12A42' : '#D0BFA5',
              width: i === screenIndex ? 16 : 6,
            }}
            className="h-1.5 rounded-full transition-all duration-200"
          />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={screen}
          className="absolute inset-0"
          custom={direction}
          variants={{
            enter:  (d) => ({ x: d >= 0 ? '100%' : '-100%' }),
            center: { x: 0 },
            exit:   (d) => ({ x: d >= 0 ? '-100%' : '100%' }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        >
          {screen === 'chat'          && <ChatScreen />}
          {screen === 'tasks'         && <TasksScreen />}
          {screen === 'gamification'  && <GamificationScreen />}
        </motion.div>
      </AnimatePresence>

      <VoiceButton />
    </div>
    </MessagesProvider>
  )
}
