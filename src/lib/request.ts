import axios from "axios"

import { AUTH_UNAUTHORIZED_EVENT, TOKEN_KEY, clearStoredAuth } from "@/contexts/auth-context"

export const DEFAULT_API_BASE_URL = "http://localhost:8888"
export const DEFAULT_ERROR_MESSAGE = "网络异常，请稍后重试"
export const DEFAULT_UNAUTHORIZED_MESSAGE = "登录已失效，请重新登录"

export interface ApiEnvelope<T> {
  code?: number
  data?: T
  message?: string
}

export interface ApiResult<T> {
  data: T
  message: string
}

const SUCCESS_CODES = new Set([0, 200])
const LARGE_INTEGER_ID_FIELD_PATTERN = /"(id|userId|reviewerId)"\s*:\s*(-?\d{16,})/g

export function formatAuthorizationHeader(token: string) {
  const normalizedToken = token.trim()

  if (/^Bearer\s+/i.test(normalizedToken)) {
    return normalizedToken
  }

  return `Bearer ${normalizedToken}`
}

function extractBackendMessage(payload: unknown): string {
  if (typeof payload === "string") {
    return payload
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>
    const candidate = record.message ?? record.msg ?? record.error

    if (typeof candidate === "string") {
      return candidate
    }
  }

  return ""
}

function isApiEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      ("code" in payload || "message" in payload),
  )
}

export function parseApiJsonPayload(payload: string) {
  const normalizedPayload = payload.trim()

  if (!normalizedPayload || !/^[[{]/.test(normalizedPayload)) {
    return payload
  }

  const protectedPayload = normalizedPayload.replace(
    LARGE_INTEGER_ID_FIELD_PATTERN,
    (_, key: string, value: string) => `"${key}":"${value}"`,
  )

  return JSON.parse(protectedPayload) as unknown
}

export function stringifyApiJsonPayload(payload: unknown) {
  return JSON.stringify(payload)
}

function isFormDataPayload(data: unknown) {
  return typeof FormData !== "undefined" && data instanceof FormData
}

function handleUnauthorized() {
  clearStoredAuth()
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT))
}

function getApiErrorMessage(codeOrStatus: number | undefined, message: string) {
  if (codeOrStatus === 401) {
    handleUnauthorized()
    return message || DEFAULT_UNAUTHORIZED_MESSAGE
  }

  if (typeof codeOrStatus === "number" && codeOrStatus >= 500) {
    return DEFAULT_ERROR_MESSAGE
  }

  return message || DEFAULT_ERROR_MESSAGE
}

export function unwrapApiResponse<T>(payload: ApiEnvelope<T> | T): ApiResult<T> {
  if (!isApiEnvelope<T>(payload)) {
    return {
      data: payload,
      message: "",
    }
  }

  const message = extractBackendMessage(payload)

  if (typeof payload.code === "number" && !SUCCESS_CODES.has(payload.code)) {
    throw new Error(getApiErrorMessage(payload.code, message))
  }

  return {
    data: payload.data as T,
    message,
  }
}

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
  transformRequest: [
    (data) => {
      if (data === null || data === undefined || typeof data === "string") {
        return data
      }

      if (isFormDataPayload(data) || data instanceof URLSearchParams) {
        return data
      }

      if (typeof data === "object") {
        return stringifyApiJsonPayload(data)
      }

      return data
    },
  ],
  transformResponse: [
    (data) => {
      if (typeof data !== "string") {
        return data
      }

      try {
        return parseApiJsonPayload(data)
      } catch {
        return data
      }
    },
  ],
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && config.headers) {
    config.headers.Authorization = formatAuthorizationHeader(token)
  }
  return config
})

request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const message = extractBackendMessage(error.response?.data)
      return Promise.reject(new Error(getApiErrorMessage(error.response?.status, message)))
    }

    return Promise.reject(new Error(DEFAULT_ERROR_MESSAGE))
  },
)

export default request
