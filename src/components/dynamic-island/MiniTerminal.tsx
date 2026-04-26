import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"

interface MiniTerminalProps {
  logs: string[]
  open: boolean
  reducedMotion: boolean
}

export function MiniTerminal({ logs, open, reducedMotion }: MiniTerminalProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open || !viewportRef.current) {
      return
    }

    viewportRef.current.scrollTop = viewportRef.current.scrollHeight
  }, [logs, open])

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="mini-terminal"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={reducedMotion ? { duration: 0.16 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="dynamic-island-terminal"
        >
          <div className="dynamic-island-terminal__header">
            <span className="dynamic-island-terminal__dot dynamic-island-terminal__dot--danger" />
            <span className="dynamic-island-terminal__dot dynamic-island-terminal__dot--warn" />
            <span className="dynamic-island-terminal__dot dynamic-island-terminal__dot--ok" />
            <span className="dynamic-island-terminal__label">Mini Terminal</span>
          </div>
          <div ref={viewportRef} className="dynamic-island-terminal__viewport">
            {logs.map((line, index) => (
              <div key={`${index}-${line}`} className="dynamic-island-terminal__line">
                {line}
              </div>
            ))}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
