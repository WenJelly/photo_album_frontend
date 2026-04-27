export type AppPage = "home" | "gallery" | "adminReview" | "me" | "user"

export function getManualLogoutRedirectRoute(currentPage: AppPage): "gallery" | null {
  switch (currentPage) {
    case "adminReview":
    case "me":
      return "gallery"
    default:
      return null
  }
}
