import { cn } from "@/lib/utils"

export interface CategoryOption {
  value: string
  label: string
}

interface CategoryFilterProps {
  active: string
  categories: CategoryOption[]
  onChange: (category: string) => void
}

export function CategoryFilter({ active, categories, onChange }: CategoryFilterProps) {
  return (
    <div
      className="no-scrollbar flex max-w-full gap-2 overflow-x-auto rounded-full border border-border/70 bg-white/72 p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.04)] backdrop-blur-xl"
      role="toolbar"
      aria-label="作品分类"
    >
      {categories.map((category) => {
        const pressed = active === category.value

        return (
          <button
            key={category.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(category.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[0.82rem] whitespace-nowrap transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              pressed
                ? "border-border/80 bg-background text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/72 hover:text-foreground",
            )}
          >
            {category.label}
          </button>
        )
      })}
    </div>
  )
}
