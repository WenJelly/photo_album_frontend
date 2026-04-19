import { useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { login as loginApi, register as registerApi } from "@/lib/auth-api"
import { useAuth } from "@/contexts/auth-context"

type AuthMode = "login" | "register"
type SubmitState = "idle" | "submitting" | "register-success" | "error"

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

const COPY = {
  backToLogin: "去登录",
  closeLabel: "关闭登录卡片",
  confirmPassword: "确认密码",
  confirmPasswordRequired: "请确认密码",
  email: "邮箱",
  emailInvalid: "请输入有效的邮箱地址",
  emailRequired: "请输入邮箱",
  forgotPassword: "忘记密码?",
  hasAccount: "已有账号?",
  loginDescription: "使用邮箱和密码访问你的图库与后续上传能力。",
  loginFailed: "登录失败，请检查邮箱和密码",
  loginSubmit: "登录",
  loginSubmitting: "登录中...",
  loginTitle: "登录",
  noAccount: "没有账号?",
  password: "密码",
  passwordMismatch: "两次输入的密码不一致",
  passwordRequired: "请输入密码",
  registerDescription: "使用邮箱创建你的帐号，后续可用于管理图库与上传内容。",
  registerFailed: "注册失败，该邮箱可能已被注册",
  registerSubmit: "注册",
  registerSubmitting: "注册中...",
  registerSuccess: "注册成功",
  registerSuccessAlert: "注册成功，接下来使用刚才填写的邮箱与密码登录即可。",
  registerSuccessDescription: "账号已创建完成，现在可以回到登录继续使用。",
  successEyebrow: "账号已创建",
  switchEyebrow: "账号入口",
} as const

const INITIAL_FIELDS: AuthFields = {
  confirmPassword: "",
  email: "",
  password: "",
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const timeoutRef = useRef<number | null>(null)
  const shouldCloseFromBackdropRef = useRef(false)
  const [mode, setMode] = useState<AuthMode>("login")
  const [fields, setFields] = useState<AuthFields>(INITIAL_FIELDS)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [apiError, setApiError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const { login: onLoginSuccess } = useAuth()

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
    setApiError(null)
    setSuccessMessage(null)
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
    setApiError(null)
    setSuccessMessage(null)
    setSubmitState("submitting")

    const email = fields.email.trim()

    if (mode === "login") {
      loginApi({ userEmail: email, userPassword: fields.password })
        .then((result) => {
          onLoginSuccess(result.data)
          onClose()
        })
        .catch((err: unknown) => {
          setSubmitState("error")
          setApiError(err instanceof Error ? err.message : COPY.loginFailed)
        })
    } else {
      registerApi({
        userEmail: email,
        userPassword: fields.password,
        userCheckPassword: fields.confirmPassword,
      })
        .then((result) => {
          setSuccessMessage(result.message || COPY.registerSuccessAlert)
          setSubmitState("register-success")
        })
        .catch((err: unknown) => {
          setSubmitState("error")
          setApiError(err instanceof Error ? err.message : COPY.registerFailed)
        })
    }
  }

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    shouldCloseFromBackdropRef.current = event.target === event.currentTarget
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    const shouldClose =
      shouldCloseFromBackdropRef.current && event.target === event.currentTarget

    shouldCloseFromBackdropRef.current = false

    if (shouldClose) {
      onClose()
    }
  }

  return (
    <div
      data-testid="auth-backdrop"
      className="fixed inset-0 z-[70] bg-[rgba(17,17,19,0.42)] backdrop-blur-[14px]"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
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
                {successMessage ?? COPY.registerSuccessAlert}
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
              {apiError ? (
                <div className="rounded-[1.4rem] border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  {apiError}
                </div>
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
