import request, { unwrapApiResponse, type ApiEnvelope, type ApiResult } from "@/lib/request"

export interface LoginParams {
  userEmail: string
  userPassword: string
}

export interface RegisterParams {
  userEmail: string
  userPassword: string
  userCheckPassword: string
}

export interface LoginResult {
  token: string
  id: string
  userEmail: string
  userName: string
  userAvatar: string
  userProfile: string
  userRole: string
  createTime: string
  updateTime: string
}

export interface RegisterResult {
  id: string
}

export type AuthActionResult<T> = ApiResult<T>

export async function login(params: LoginParams): Promise<AuthActionResult<LoginResult>> {
  const { data } = await request.post<ApiEnvelope<LoginResult>>("/api/user/login", params)
  return unwrapApiResponse(data)
}

export async function register(params: RegisterParams): Promise<AuthActionResult<RegisterResult>> {
  const { data } = await request.post<ApiEnvelope<RegisterResult>>("/api/user/register", params)
  return unwrapApiResponse(data)
}
