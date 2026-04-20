import type { AuthUser } from "@/contexts/auth-context"

interface OwnablePicture {
  userId?: string
}

export function canDeletePhoto(user: Pick<AuthUser, "id" | "userRole"> | null, photo: OwnablePicture | null) {
  if (!user || !photo) {
    return false
  }

  if (user.userRole === "admin") {
    return true
  }

  return photo.userId !== undefined && String(photo.userId) === String(user.id)
}
