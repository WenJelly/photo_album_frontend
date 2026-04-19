import axios from "axios"

export const DEFAULT_API_BASE_URL = "http://localhost:8888"
export const DEFAULT_ERROR_MESSAGE = "网络异常，请稍后重试"

export interface ApiEnvelope<T> {
  code?: number
  data: T
  message?: string
}

export interface ApiResult<T> {
  data: T
  message: string
}

const SUCCESS_CODES = new Set([0, 200])

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
      "data" in payload &&
      ("code" in payload || "message" in payload),
  )
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
    throw new Error(message || DEFAULT_ERROR_MESSAGE)
  }

  return {
    data: payload.data,
    message,
  }
}

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
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

      if (message) {
        return Promise.reject(new Error(message))
      }
    }

    return Promise.reject(new Error(DEFAULT_ERROR_MESSAGE))
  },
)

export default request
