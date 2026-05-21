import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react"

interface TransitionContextValue {
  startTransition: () => Promise<void>
  reveal: () => void
  phase: "idle" | "leaving" | "entering"
}

const TransitionContext = createContext<TransitionContextValue | null>(null)

export function usePageTransition(): TransitionContextValue {
  const ctx = useContext(TransitionContext)

  if (!ctx) {
    throw new Error("usePageTransition must be used within TransitionProvider")
  }

  return ctx
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

const LEAVE_DURATION = 160
const ENTER_DURATION = 260

export function TransitionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"idle" | "leaving" | "entering">("idle")
  const busyRef = useRef(false)

  const reveal = useCallback(() => {
    setPhase("entering")
    setTimeout(() => {
      setPhase("idle")
      busyRef.current = false
    }, ENTER_DURATION)
  }, [])

  const startTransition = useCallback((): Promise<void> => {
    if (busyRef.current) {
      return Promise.resolve()
    }

    busyRef.current = true

    if (prefersReducedMotion()) {
      setPhase("leaving")
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    }

    setPhase("leaving")

    return new Promise((resolve) => {
      setTimeout(resolve, LEAVE_DURATION)
    })
  }, [])

  return (
    <TransitionContext.Provider value={{ startTransition, reveal, phase }}>
      {children}
    </TransitionContext.Provider>
  )
}
