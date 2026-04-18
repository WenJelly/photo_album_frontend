import { categoryLabels, type Category } from "@/data/photos"

interface GallerySummaryProps {
  totalCount: number
  categoryCount: number
  activeCategory: Category
  filteredCount: number
}

export function GallerySummary({
  totalCount,
  categoryCount,
  activeCategory,
  filteredCount,
}: GallerySummaryProps) {
  return (
    <section className="rounded-[28px] border border-border/70 bg-white/76 px-4 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl md:px-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <p className="eyebrow-label">当前分类</p>
          <p className="text-base font-medium tracking-[-0.03em] text-foreground">
            {categoryLabels[activeCategory]}
          </p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow-label">作品总量</p>
          <p className="text-base font-medium tracking-[-0.03em] text-foreground">共 {totalCount} 幅</p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow-label">当前显示</p>
          <p className="text-base font-medium tracking-[-0.03em] text-foreground">当前 {filteredCount} 幅</p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow-label">专题数量</p>
          <p className="text-base font-medium tracking-[-0.03em] text-foreground">{categoryCount} 个主题</p>
        </div>
      </div>
    </section>
  )
}
