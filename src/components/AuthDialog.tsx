import { useLayoutEffect, useRef, useState, type FormEvent } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "register"
type SubmitState = "idle" | "submitting" | "register-success"

interface AuthDialogProps {
  open: boolean
  onClose: () => void
}

interface AuthFields {
  email: string
  password: string
  confirmPassword: string
}

interface FieldErrors {
  email?: string
  password?: string
  confirmPassword?: string
}

interface FieldProps {
  autoComplete?: string
  autoFocus?: boolean
  error?: string
  label: string
  onChange: (value: string) => void
  type: string
  value: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SUBMIT_DELAY_MS = 650

const COPY = {
  backToLogin: "\u53bb\u767b\u5f55",
  closeLabel: "\u5173\u95ed\u767b\u5f55\u5361\u7247",
  confirmPassword: "\u786e\u8ba4\u5bc6\u7801",
  confirmPasswordRequired: "\u8bf7\u786e\u8ba4\u5bc6\u7801",
  email: "\u90ae\u7bb1",
  emailInvalid: "\u8bf7\u8f93\u5165\u6709\u6548\u7684\u90ae\u7bb1\u5730\u5740",
  emailRequired: "\u8bf7\u8f93\u5165\u90ae\u7bb1",
  forgotPassword: "\u5fd8\u8bb0\u5bc6\u7801?",
  hasAccount: "\u5df2\u6709\u8d26\u53f7?",
  loginDescription:
    "\u4f7f\u7528\u90ae\u7bb1\u548c\u5bc6\u7801\u8bbf\u95ee\u4f60\u7684\u56fe\u5e93\u4e0e\u540e\u7eed\u4e0a\u4f20\u80fd\u529b\u3002",
  loginSubmit: "\u767b\u5f55",
  loginSubmitting: "\u767b\u5f55\u4e2d...",
  loginTitle: "\u767b\u5f55",
  noAccount: "\u6ca1\u6709\u8d26\u53f7?",
  password: "\u5bc6\u7801",
  passwordMismatch: "\u4e24\u6b21\u8f93\u5165\u7684\u5bc6\u7801\u4e0d\u4e00\u81f4",
  passwordRequired: "\u8bf7\u8f93\u5165\u5bc6\u7801",
  registerDescription:
    "\u4f7f\u7528\u90ae\u7bb1\u521b\u5efa\u4f60\u7684\u5e10\u53f7\uff0c\u540e\u7eed\u53ef\u7528\u4e8e\u7ba1\u7406\u56fe\u5e93\u4e0e\u4e0a\u4f20\u5185\u5bb9\u3002",
  registerSubmit: "\u6ce8\u518c",
  registerSubmitting: "\u6ce8\u518c\u4e2d...",
  registerSuccess: "\u6ce8\u518c\u6210\u529f",
  registerSuccessAlert:
    "\u6ce8\u518c\u6210\u529f\uff0c\u63a5\u4e0b\u6765\u4f7f\u7528\u521a\u624d\u586b\u5199\u7684\u90ae\u7bb1\u4e0e\u5bc6\u7801\u767b\u5f55\u5373\u53ef\u3002",
  registerSuccessDescription:
    "\u8d26\u53f7\u5df2\u521b\u5efa\u5b8c\u6210\uff0c\u73b0\u5728\u53ef\u4ee5\u56de\u5230\u767b\u5f55\u7ee7\u7eed\u4f7f\u7528\u3002",
  successEyebrow: "\u8d26\u53f7\u5df2\u521b\u5efa",
  switchEyebrow: "\u8d26\u53f7\u5165\u53e3",
} as const

const INITIAL_FIELDS: AuthFields = {
  confirmPassword: "",
  email: "",
  password: "",
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const timeoutRef = useRef<number | null>(null)
  const [mode, setMode] = useState<AuthMode>("login")
  const [fields, setFields] = useState<AuthFields>(INITIAL_FIELDS)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>("idle")

  const title =
    submitState === "register-success"
      ? COPY.registerSuccess
      : mode === "login"
        ? COPY.loginTitle
        : COPY.registerSubmit

  const description =
    submitState === "register-success"
      ? COPY.registerSuccessDescription
      : mode === "login"
        ? COPY.loginDescription
        : COPY.registerDescription

  const eyebrow = submitState === "register-success" ? COPY.successEyebrow : COPY.switchEyebrow

  const clearPendingTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const resetFieldsForMode = () => {
    setErrors({})
    setSubmitState("idle")
    setFields((current) => ({
      confirmPassword: "",
      email: current.email,
      password: "",
    }))
  }

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      clearPendingTimeout()
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  const setField = (field: keyof AuthFields, value: string) => {
    setFields((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    resetFieldsForMode()
  }

  const resetToLogin = () => {
    setMode("login")
    resetFieldsForMode()
  }

  const validate = () => {
    const nextErrors: FieldErrors = {}
    const email = fields.email.trim()

    if (!email) {
      nextErrors.email = COPY.emailRequired
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = COPY.emailInvalid
    }

    if (!fields.password) {
      nextErrors.password = COPY.passwordRequired
    }

    if (mode === "register") {
      if (!fields.confirmPassword) {
        nextErrors.confirmPassword = COPY.confirmPasswordRequired
      } else if (fields.confirmPassword !== fields.password) {
        nextErrors.confirmPassword = COPY.passwordMismatch
      }
    }

    setErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!validate()) {
      return
    }

    clearPendingTimeout()
    setSubmitState("submitting")
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null

      if (mode === "login") {
        onClose()
        return
      }

      setSubmitState("register-success")
    }, SUBMIT_DELAY_MS)
  }

  return (
    <div
      data-testid="auth-backdrop"
      className="fixed inset-0 z-[70] bg-[rgba(17,17,19,0.42)] backdrop-blur-[14px]"
      onClick={onClose}
    >
      <div className="flex min-h-screen items-center justify-center p-4 md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="w-full max-w-[456px] rounded-[2rem] border border-black/10 bg-[#fbfaf7]/96 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl md:p-7"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="eyebrow-label">{eyebrow}</p>
              <h2 className="text-[1.9rem] font-medium tracking-[-0.05em] text-foreground">{title}</h2>
              <p className="max-w-[32ch] text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            <button
              type="button"
              aria-label={COPY.closeLabel}
              className="inline-flex rounded-full border border-border/70 bg-background/82 p-2 text-foreground transition hover:bg-secondary"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>

          {submitState === "register-success" ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-[1.4rem] border border-emerald-500/18 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-950/88">
                {COPY.registerSuccessAlert}
              </div>
              <Button className="h-11 w-full rounded-2xl" onClick={resetToLogin}>
                {COPY.backToLogin}
              </Button>
            </div>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
              <Field
                label={COPY.email}
                type="email"
                value={fields.email}
                error={errors.email}
                autoComplete="email"
                autoFocus
                onChange={(value) => setField("email", value)}
              />
              <div className="space-y-2">
                <Field
                  label={COPY.password}
                  type="password"
                  value={fields.password}
                  error={errors.password}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  onChange={(value) => setField("password", value)}
                />
                {mode === "login" ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      {COPY.forgotPassword}
                    </button>
                  </div>
                ) : null}
              </div>
              {mode === "register" ? (
                <Field
                  label={COPY.confirmPassword}
                  type="password"
                  value={fields.confirmPassword}
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                  onChange={(value) => setField("confirmPassword", value)}
                />
              ) : null}
              <Button
                type="submit"
                className="mt-2 h-11 w-full rounded-2xl"
                disabled={submitState === "submitting"}
              >
                {submitState === "submitting"
                  ? mode === "login"
                    ? COPY.loginSubmitting
                    : COPY.registerSubmitting
                  : mode === "login"
                    ? COPY.loginSubmit
                    : COPY.registerSubmit}
              </Button>
            </form>
          )}

          {submitState !== "register-success" ? (
            <div className="mt-6 border-t border-border/70 pt-4 text-sm text-muted-foreground">
              {mode === "login" ? COPY.noAccount : COPY.hasAccount}{" "}
              <button
                type="button"
                className="font-medium text-foreground transition hover:opacity-75"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? COPY.registerSubmit : COPY.loginSubmit}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Field({ autoComplete, autoFocus, error, label, onChange, type, value }: FieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        aria-invalid={error ? "true" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full rounded-2xl border bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-muted-foreground/80 focus:border-foreground/28 focus:ring-2 focus:ring-ring/20",
          error ? "border-destructive/45" : "border-border/80"
        )}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </label>
  )
}
