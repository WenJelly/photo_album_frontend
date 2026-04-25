import { cn } from "@/lib/utils"

interface BoluoLogoProps {
  className?: string
}

export function BoluoLogo({ className }: BoluoLogoProps) {
  return (
    <img
      src="/boluo.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("dynamic-island-geometry-lock select-none", className)}
    />
  )
}
