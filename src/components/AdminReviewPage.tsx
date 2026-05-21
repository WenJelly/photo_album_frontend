import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  ImageIcon,
  Search,
  UserRound,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  listAdminPictures,
  reviewPicture,
  type AdminPictureRecord,
  type ListAdminPicturesParams,
  type ReviewPictureParams,
} from "@/lib/admin-picture-api"
import { DELETE_PICTURE_CONFIRM_MESSAGE } from "@/lib/picture-delete"
import { deletePicture } from "@/lib/picture-api"
import { cn } from "@/lib/utils"

interface AdminReviewPageProps {
  currentUserRole?: string
}

type ReviewPageState = "loading" | "ready" | "error"
type ReviewStatusFilter = -1 | 0 | 1 | 2

interface ReviewSearchState {
  content: string
  reviewStatus: ReviewStatusFilter
  uploadEnd: string
  uploadStart: string
}

const REVIEW_STATUS_LABELS: Record<number, string> = {
  0: "待审核",
  1: "已通过",
  2: "已退回",
}

const STATUS_FILTERS: Array<{ label: string; value: ReviewStatusFilter }> = [
  { label: "全部", value: -1 },
  { label: "待审核", value: 0 },
  { label: "已通过", value: 1 },
  { label: "已退回", value: 2 },
]

const ADMIN_REVIEW_PAGE_SIZE = 20

function createDefaultSearchState(): ReviewSearchState {
  return {
    reviewStatus: -1,
    content: "",
    uploadStart: "",
    uploadEnd: "",
  }
}

function getReviewStatusLabel(reviewStatus?: number) {
  if (reviewStatus === undefined) return "未知"
  return REVIEW_STATUS_LABELS[reviewStatus] ?? "未知"
}

function getReviewStatusClass(reviewStatus?: number) {
  if (reviewStatus === 1) return "bg-[oklch(0.96_0.02_158)] text-[oklch(0.39_0.09_158)]"
  if (reviewStatus === 2) return "bg-[oklch(0.96_0.022_24)] text-[oklch(0.44_0.11_24)]"
  return "bg-[oklch(0.96_0.026_76)] text-[oklch(0.43_0.09_68)]"
}

function getPictureTitle(record: AdminPictureRecord) {
  return record.name?.trim() || `图片 ${record.id}`
}

function getUploaderDisplay(record: Pick<AdminPictureRecord, "user" | "userId">) {
  const userName = record.user?.userName?.trim()
  const userId = record.userId ?? record.user?.id
  if (userName) return userName
  if (userId) return `用户 #${userId}`
  return "未记录"
}

function mergeAdminPictureRecord(currentRecord: AdminPictureRecord, nextRecord: AdminPictureRecord): AdminPictureRecord {
  return {
    ...currentRecord,
    ...nextRecord,
    thumbnailUrl: currentRecord.thumbnailUrl ?? nextRecord.thumbnailUrl,
    userId: nextRecord.userId ?? currentRecord.userId,
    user: nextRecord.user ?? currentRecord.user,
  }
}

function getStatusParam(reviewStatus: ReviewStatusFilter) {
  return reviewStatus === -1 ? undefined : reviewStatus
}

function formatDateTimeForApi(value: string) {
  if (!value.trim()) return undefined
  const normalized = value.replace("T", " ")
  return normalized.length === 16 ? `${normalized}:00` : normalized
}

function buildAdminReviewFilters(search: ReviewSearchState, pageNum = 1): ListAdminPicturesParams {
  const searchText = search.content.trim()
  return {
    pageNum,
    pageSize: ADMIN_REVIEW_PAGE_SIZE,
    reviewStatus: getStatusParam(search.reviewStatus),
    searchText: searchText || undefined,
    editTimeStart: formatDateTimeForApi(search.uploadStart),
    editTimeEnd: formatDateTimeForApi(search.uploadEnd),
  }
}

function formatDisplayDate(value?: string) {
  if (!value) return "-"
  const timestamp = Date.parse(value.replace(" ", "T"))
  if (Number.isNaN(timestamp)) return value
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp))
}

function formatFileSize(value?: number) {
  if (!value || !Number.isFinite(value)) return "-"
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  if (value >= 1024) return `${Math.round(value / 1024)} KB`
  return `${Math.round(value)} B`
}

function formatDimensions(record: AdminPictureRecord) {
  if (!record.picWidth || !record.picHeight) return "-"
  return `${record.picWidth} × ${record.picHeight}`
}

function getRiskSignals(record: AdminPictureRecord) {
  const signals: string[] = []
  if (!record.introduction?.trim()) signals.push("缺说明")
  if (!record.category?.trim()) signals.push("未分类")
  if (!record.tags.length) signals.push("缺标签")
  if (!record.picWidth || !record.picHeight) signals.push("尺寸异常")
  if (record.reviewStatus === 2 && record.reviewMessage) signals.push("已有退回意见")
  return signals
}

function QueueRow({
  record,
  isActive,
  isSelected,
  onOpen,
  onToggleSelect,
}: {
  record: AdminPictureRecord
  isActive: boolean
  isSelected: boolean
  onOpen: (record: AdminPictureRecord) => void
  onToggleSelect: (id: string, checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(record)}
      data-record-id={record.id}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-100",
        isActive
          ? "bg-foreground/[0.06]"
          : "hover:bg-foreground/[0.03]",
      )}
      aria-current={isActive ? "true" : undefined}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation()
          onToggleSelect(record.id, e.target.checked)
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`选择 ${getPictureTitle(record)}`}
        className="size-3.5 shrink-0 rounded border-border accent-foreground"
      />
      <img
        src={record.thumbnailUrl ?? record.url}
        alt=""
        width={64}
        height={44}
        loading="lazy"
        decoding="async"
        draggable="false"
        className="size-11 shrink-0 rounded-md object-cover bg-secondary/60"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{getPictureTitle(record)}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {getUploaderDisplay(record)} · {formatDisplayDate(record.createTime ?? record.editTime)}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
          getReviewStatusClass(record.reviewStatus),
        )}
      >
        {getReviewStatusLabel(record.reviewStatus)}
      </span>
    </button>
  )
}

function KeyboardHintsPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground">快捷键</h3>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {[
            ["J / ↓", "下一张"],
            ["K / ↑", "上一张"],
            ["Enter", "通过"],
            ["R", "退回（焦点到意见框）"],
            ["Space", "加入 / 移出批量"],
            ["O", "查看原图"],
            ["D", "删除"],
            ["?", "显示 / 关闭快捷键"],
          ].map(([key, desc]) => (
            <div key={key} className="contents">
              <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
              <dd className="text-foreground">{desc}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/80"
        >
          关闭
        </button>
      </div>
    </div>
  )
}

export function AdminReviewPage({ currentUserRole }: AdminReviewPageProps) {
  const [searchDraft, setSearchDraft] = useState<ReviewSearchState>(() => createDefaultSearchState())
  const [appliedSearch, setAppliedSearch] = useState<ReviewSearchState>(() => createDefaultSearchState())
  const [filters, setFilters] = useState<ListAdminPicturesParams>(() =>
    buildAdminReviewFilters(createDefaultSearchState()),
  )
  const [pageState, setPageState] = useState<ReviewPageState>("loading")
  const [records, setRecords] = useState<AdminPictureRecord[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedPicture, setSelectedPicture] = useState<AdminPictureRecord | null>(null)
  const [selectedPictureError, setSelectedPictureError] = useState<string | null>(null)
  const [detailReviewMessage, setDetailReviewMessage] = useState("")
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [isSubmittingDetailAction, setIsSubmittingDetailAction] = useState(false)
  const [isDeletingSelectedPicture, setIsDeletingSelectedPicture] = useState(false)
  const [isBatchRejectMode, setIsBatchRejectMode] = useState(false)
  const [batchReviewMessage, setBatchReviewMessage] = useState("")
  const [isSubmittingBatchAction, setIsSubmittingBatchAction] = useState(false)
  const [showKeyboardHints, setShowKeyboardHints] = useState(false)
  const [autoAdvance] = useState(() => {
    try { return localStorage.getItem("review-auto-advance") !== "off" } catch { return true }
  })

  const reviewMessageRef = useRef<HTMLTextAreaElement>(null)
  const shellRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (currentUserRole !== "admin") return
    let isCancelled = false
    const load = async () => {
      setPageState("loading")
      setErrorMessage(null)
      try {
        const result = await listAdminPictures(filters)
        if (isCancelled) return
        setRecords(result.list)
        setTotalRecords(result.total)
        const visibleIdSet = new Set(result.list.map((r) => r.id))
        setSelectedIds((cur) => cur.filter((id) => visibleIdSet.has(id)))
        setSelectedPicture((cur) => {
          if (cur) {
            const refreshed = result.list.find((r) => r.id === cur.id)
            if (refreshed) return mergeAdminPictureRecord(cur, refreshed)
          }
          return result.list[0] ?? null
        })
        setPageState("ready")
      } catch (error) {
        if (isCancelled) return
        setPageState("error")
        setErrorMessage(error instanceof Error ? error.message : "审核列表暂时无法加载。")
      }
    }
    void load()
    return () => { isCancelled = true }
  }, [currentUserRole, filters])

  const pageSize = filters.pageSize ?? ADMIN_REVIEW_PAGE_SIZE
  const currentPageNum = filters.pageNum ?? 1
  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalRecords / pageSize)), [pageSize, totalRecords])
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedCount = selectedIds.length
  const selectedPictureTitle = selectedPicture ? getPictureTitle(selectedPicture) : ""
  const selectedPictureRisks = selectedPicture ? getRiskSignals(selectedPicture) : []
  const selectedPictureInBatch = selectedPicture ? selectedIdSet.has(selectedPicture.id) : false

  const applySearch = useCallback((nextSearch: ReviewSearchState, pageNum = 1) => {
    setActionNotice(null)
    setAppliedSearch(nextSearch)
    startTransition(() => { setFilters(buildAdminReviewFilters(nextSearch, pageNum)) })
  }, [])

  const handleSearchSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    applySearch(searchDraft, 1)
  }, [applySearch, searchDraft])

  const handleResetSearch = useCallback(() => {
    const next = createDefaultSearchState()
    setSearchDraft(next)
    applySearch(next, 1)
  }, [applySearch])

  const handleStatusFilter = useCallback((status: ReviewStatusFilter) => {
    const next = { ...searchDraft, reviewStatus: status }
    setSearchDraft(next)
    applySearch(next, 1)
  }, [applySearch, searchDraft])

  const handlePageChange = useCallback((nextPage: number) => {
    const clamped = Math.min(Math.max(1, nextPage), pageCount)
    if (clamped === currentPageNum) return
    applySearch(appliedSearch, clamped)
  }, [appliedSearch, applySearch, currentPageNum, pageCount])

  const handleToggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((cur) => checked ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((v) => v !== id))
  }, [])

  const handleOpenDetail = useCallback((record: AdminPictureRecord) => {
    setSelectedPicture(record)
    setSelectedPictureError(null)
    setDetailReviewMessage(record.reviewMessage ?? "")
    setActionNotice(null)
  }, [])

  const applyRecordUpdate = useCallback((updated: AdminPictureRecord) => {
    setRecords((cur) => {
      const next = cur.map((r) => r.id === updated.id ? mergeAdminPictureRecord(r, updated) : r)
      const statusParam = getStatusParam(appliedSearch.reviewStatus)
      return statusParam === undefined ? next : next.filter((r) => r.reviewStatus === statusParam)
    })
    setSelectedPicture((cur) => cur?.id === updated.id ? mergeAdminPictureRecord(cur, updated) : cur)
  }, [appliedSearch.reviewStatus])

  const submitReviewAction = useCallback(async (params: ReviewPictureParams) => {
    const updated = await reviewPicture(params)
    applyRecordUpdate(updated)
    return updated
  }, [applyRecordUpdate])

  const advanceToNext = useCallback(() => {
    if (!selectedPicture || !autoAdvance) return
    const idx = records.findIndex((r) => r.id === selectedPicture.id)
    const next = records[idx + 1] ?? records[idx - 1]
    if (next) handleOpenDetail(next)
    else setSelectedPicture(null)
  }, [autoAdvance, handleOpenDetail, records, selectedPicture])

  const handleDetailReview = useCallback(async (reviewStatus: 1 | 2) => {
    if (!selectedPicture) return
    const msg = detailReviewMessage.trim()
    if (reviewStatus === 2 && !msg) {
      setSelectedPictureError("退回时请说明原因。")
      reviewMessageRef.current?.focus()
      return
    }
    setIsSubmittingDetailAction(true)
    setSelectedPictureError(null)
    setActionNotice(null)
    try {
      await submitReviewAction({ id: selectedPicture.id, reviewStatus, reviewMessage: msg || undefined })
      setActionNotice(`已${reviewStatus === 1 ? "通过" : "退回"}。`)
      advanceToNext()
    } catch (error) {
      setSelectedPictureError(error instanceof Error ? error.message : "操作未保存。")
    } finally {
      setIsSubmittingDetailAction(false)
    }
  }, [advanceToNext, detailReviewMessage, selectedPicture, submitReviewAction])

  const handleBatchReview = useCallback(async (reviewStatus: 1 | 2) => {
    if (!selectedIds.length) return
    const msg = batchReviewMessage.trim()
    if (reviewStatus === 2 && !msg) {
      setActionNotice("批量退回时请填写统一原因。")
      return
    }
    setIsSubmittingBatchAction(true)
    setActionNotice(null)
    let ok = 0
    try {
      for (const id of selectedIds) {
        await submitReviewAction({ id, reviewStatus, reviewMessage: msg || undefined })
        ok += 1
      }
      setSelectedIds([])
      setBatchReviewMessage("")
      setIsBatchRejectMode(false)
      setActionNotice(`批量完成：${ok} 张已${reviewStatus === 1 ? "通过" : "退回"}。`)
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "批量操作失败。")
    } finally {
      setIsSubmittingBatchAction(false)
    }
  }, [batchReviewMessage, selectedIds, submitReviewAction])

  const handleDeleteSelectedPicture = useCallback(async () => {
    if (!selectedPicture) return
    if (!window.confirm(DELETE_PICTURE_CONFIRM_MESSAGE)) return
    setIsDeletingSelectedPicture(true)
    setSelectedPictureError(null)
    try {
      const deleted = await deletePicture(selectedPicture.id)
      setRecords((cur) => cur.filter((r) => r.id !== deleted.id))
      setSelectedIds((cur) => cur.filter((id) => id !== deleted.id))
      advanceToNext()
      setActionNotice(`已删除图片 ${deleted.id}。`)
    } catch (error) {
      setSelectedPictureError(error instanceof Error ? error.message : "删除失败。")
    } finally {
      setIsDeletingSelectedPicture(false)
    }
  }, [advanceToNext, selectedPicture])

  const handleToggleBatch = useCallback(() => {
    if (!selectedPicture) return
    handleToggleSelect(selectedPicture.id, !selectedIdSet.has(selectedPicture.id))
  }, [handleToggleSelect, selectedIdSet, selectedPicture])

  const handleOpenOriginal = useCallback(() => {
    if (!selectedPicture) return
    window.open(selectedPicture.url, "_blank", "noopener,noreferrer")
  }, [selectedPicture])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
      if (isInput && e.key !== "Escape") return
      if (showKeyboardHints && e.key === "Escape") { setShowKeyboardHints(false); return }

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault()
          if (!selectedPicture) { if (records[0]) handleOpenDetail(records[0]); return }
          const idx = records.findIndex((r) => r.id === selectedPicture.id)
          const next = records[idx + 1]
          if (next) handleOpenDetail(next)
          break
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault()
          if (!selectedPicture) return
          const idx = records.findIndex((r) => r.id === selectedPicture.id)
          const prev = records[idx - 1]
          if (prev) handleOpenDetail(prev)
          break
        }
        case "Enter": {
          e.preventDefault()
          void handleDetailReview(1)
          break
        }
        case "r":
        case "R": {
          e.preventDefault()
          reviewMessageRef.current?.focus()
          break
        }
        case " ": {
          e.preventDefault()
          handleToggleBatch()
          break
        }
        case "o":
        case "O": {
          e.preventDefault()
          handleOpenOriginal()
          break
        }
        case "d":
        case "D": {
          e.preventDefault()
          void handleDeleteSelectedPicture()
          break
        }
        case "?": {
          e.preventDefault()
          setShowKeyboardHints((v) => !v)
          break
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleDeleteSelectedPicture, handleDetailReview, handleOpenDetail, handleOpenOriginal, handleToggleBatch, records, selectedPicture, showKeyboardHints])

  if (currentUserRole !== "admin") {
    return (
      <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 md:px-6">
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          请使用管理员账号访问图片审核页面。
        </div>
      </section>
    )
  }

  return (
    <section
      ref={shellRef}
      data-testid="admin-review-shell"
      className="mx-auto flex h-[calc(100vh-7rem)] max-w-[1480px] flex-col px-4 md:px-6"
    >
      {/* Topbar */}
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border/70 pb-3">
        <div className="mr-auto">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Review</p>
          <h1 className="text-lg font-semibold tracking-[-0.03em] text-foreground">图片审核</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => handleStatusFilter(f.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-100",
                appliedSearch.reviewStatus === f.value
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label="搜索"
              value={searchDraft.content}
              onChange={(e) => setSearchDraft((s) => ({ ...s, content: e.target.value }))}
              placeholder="标题、作者、标签"
              className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <Button type="submit" variant="secondary" className="h-8 px-3 text-xs">搜索</Button>
          <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={handleResetSearch}>重置</Button>
        </form>
      </header>

      {/* Three-column layout */}
      <div className="flex min-h-0 flex-1 gap-0 pt-3">
        {/* Left: Queue */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-border/70 pr-3 xl:w-80">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-medium text-muted-foreground">
              {totalRecords} 张 · 第 {currentPageNum}/{pageCount} 页
            </p>
            <div className="flex gap-1">
              <button type="button" onClick={() => handlePageChange(currentPageNum - 1)} disabled={currentPageNum <= 1} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition hover:bg-secondary disabled:opacity-30">←</button>
              <button type="button" onClick={() => handlePageChange(currentPageNum + 1)} disabled={currentPageNum >= pageCount} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition hover:bg-secondary disabled:opacity-30">→</button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar">
            {pageState === "loading" ? (
              <div className="space-y-2 py-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <div className="size-11 shrink-0 animate-pulse rounded-md bg-secondary" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pageState === "error" ? (
              <div className="px-3 py-8 text-center text-sm text-destructive">
                <p>{errorMessage ?? "加载失败。"}</p>
                <button type="button" onClick={() => applySearch(appliedSearch, currentPageNum)} className="mt-2 text-xs underline">重试</button>
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-1 items-center justify-center px-3 text-center text-sm text-muted-foreground">
                无结果。试试重置筛选条件。
              </div>
            ) : (
              <div className="space-y-0.5">
                {records.map((record) => (
                  <QueueRow
                    key={record.id}
                    record={record}
                    isActive={selectedPicture?.id === record.id}
                    isSelected={selectedIdSet.has(record.id)}
                    onOpen={handleOpenDetail}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Center: Photo */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-6 py-4">
          {selectedPicture ? (
            <div key={selectedPicture.id} className={cn("relative flex w-full max-w-3xl justify-center transition-opacity duration-200", isSubmittingDetailAction && "opacity-50")}>
              <div className="overflow-hidden rounded-xl">
                <img
                  data-testid="admin-review-hero-image"
                  src={selectedPicture.url}
                  alt={selectedPictureTitle}
                  width={selectedPicture.picWidth}
                  height={selectedPicture.picHeight}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  draggable="false"
                  className="block max-h-[calc(100vh-16rem)] max-w-full"
                />
              </div>
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md bg-foreground/60 px-2.5 py-1 text-xs text-background">
                <span>#{selectedPicture.id}</span>
                <span>{formatDimensions(selectedPicture)}</span>
                <span className="uppercase">{selectedPicture.picFormat || ""}</span>
                <span>{formatFileSize(selectedPicture.picSize)}</span>
              </div>
            </div>
          ) : pageState === "ready" && records.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">
              <p>当前筛选条件下没有待处理的图片。</p>
            </div>
          ) : pageState === "ready" && records.length > 0 ? (
            <div className="text-center text-sm text-muted-foreground">
              <p>从左侧队列选择一张图片。</p>
            </div>
          ) : pageState === "loading" ? (
            <div className="h-64 w-full max-w-3xl animate-pulse rounded-lg bg-secondary" />
          ) : null}
        </div>

        {/* Right: Decision panel */}
        <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/70 pl-4 xl:w-96">
          {selectedPicture ? (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-medium", getReviewStatusClass(selectedPicture.reviewStatus))}>
                    {getReviewStatusLabel(selectedPicture.reviewStatus)}
                  </span>
                  <span className="text-xs text-muted-foreground">#{selectedPicture.id}</span>
                </div>
                <h2 className="mt-2 text-base font-semibold leading-tight tracking-[-0.02em] text-foreground">{selectedPictureTitle}</h2>
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{selectedPicture.introduction || "暂无说明。"}</p>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <UserRound className="size-3.5 text-muted-foreground" />
                  <span className="truncate text-foreground">{getUploaderDisplay(selectedPicture)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-3.5 text-muted-foreground" />
                  <span className="truncate text-foreground">{selectedPicture.category || "未分类"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-3.5 text-muted-foreground" />
                  <span className="text-foreground">{formatDisplayDate(selectedPicture.createTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="size-3.5 text-muted-foreground" />
                  <span className="text-foreground">{selectedPicture.viewCount ?? 0} / {selectedPicture.likeCount ?? 0}</span>
                </div>
              </dl>

              {selectedPictureRisks.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPictureRisks.map((s) => (
                    <span key={s} className="rounded-full bg-[oklch(0.96_0.026_76)] px-2 py-0.5 text-[0.65rem] font-medium text-[oklch(0.43_0.09_68)]">{s}</span>
                  ))}
                </div>
              ) : (
                <span className="inline-block rounded-full bg-[oklch(0.96_0.02_158)] px-2 py-0.5 text-[0.65rem] font-medium text-[oklch(0.35_0.075_158)]">信息完整</span>
              )}

              {selectedPicture.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPicture.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground">{tag}</span>
                  ))}
                </div>
              ) : null}

              <div className="border-t border-border/70 pt-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">审核意见</span>
                  <textarea
                    ref={reviewMessageRef}
                    value={detailReviewMessage}
                    onChange={(e) => setDetailReviewMessage(e.target.value)}
                    placeholder="写明退回原因（必填）；通过时可留备注。"
                    className={cn(
                      "min-h-20 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/20",
                      selectedPictureError ? "border-destructive" : "border-border",
                    )}
                  />
                </label>
                {selectedPictureError ? (
                  <p className="mt-1.5 text-xs text-destructive">{selectedPictureError}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleDetailReview(1)} disabled={isSubmittingDetailAction} className="h-8 gap-1.5 text-xs">
                  <CheckCircle2 className="size-3.5" /> 通过 <kbd className="ml-1 rounded border border-background/30 px-1 font-mono text-[0.55rem]">Enter</kbd>
                </Button>
                <Button variant="destructive" onClick={() => void handleDetailReview(2)} disabled={isSubmittingDetailAction} className="h-8 gap-1.5 text-xs">
                  <XCircle className="size-3.5" /> 退回 <kbd className="ml-1 rounded border border-background/30 px-1 font-mono text-[0.55rem]">R</kbd>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleToggleBatch} className="h-7 text-xs">
                  {selectedPictureInBatch ? "移出批量" : "加入批量"}
                </Button>
                <Button variant="outline" onClick={handleOpenOriginal} className="h-7 text-xs">原图</Button>
                <Button variant="destructive" onClick={() => void handleDeleteSelectedPicture()} disabled={isDeletingSelectedPicture} className="h-7 text-xs">删除</Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              从左侧队列选择图片开始审核。
            </div>
          )}
        </aside>

      </div>

      {/* Footer */}
      <footer className="flex shrink-0 items-center justify-between border-t border-border/70 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {selectedCount > 0 ? (
            <>
              <span>已选 {selectedCount} 张</span>
              <Button variant="secondary" className="h-6 px-2 text-xs" onClick={() => void handleBatchReview(1)} disabled={isSubmittingBatchAction}>批量通过</Button>
              <Button variant="destructive" className="h-6 px-2 text-xs" onClick={() => setIsBatchRejectMode((v) => !v)} disabled={isSubmittingBatchAction}>批量退回</Button>
            </>
          ) : (
            <span>{pageState === "ready" ? `${totalRecords} 张图片` : ""}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline">
            <kbd className="rounded border border-border bg-secondary px-1 font-mono text-[0.6rem]">J</kbd>/<kbd className="rounded border border-border bg-secondary px-1 font-mono text-[0.6rem]">K</kbd> 切换
            <kbd className="ml-2 rounded border border-border bg-secondary px-1 font-mono text-[0.6rem]">Enter</kbd> 通过
            <kbd className="ml-2 rounded border border-border bg-secondary px-1 font-mono text-[0.6rem]">R</kbd> 退回
          </span>
          <button type="button" onClick={() => setShowKeyboardHints(true)} className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[0.6rem] transition hover:bg-secondary/80">?</button>
        </div>
      </footer>

      {/* Batch reject inline */}
      {isBatchRejectMode && selectedCount > 0 ? (
        <div className="shrink-0 border-t border-border/70 py-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">批量退回原因</span>
            <textarea
              value={batchReviewMessage}
              onChange={(e) => setBatchReviewMessage(e.target.value)}
              placeholder="必填。所有选中图片将使用同一原因。"
              className="min-h-16 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <Button variant="destructive" className="h-7 text-xs" onClick={() => void handleBatchReview(2)} disabled={isSubmittingBatchAction}>确认退回 {selectedCount} 张</Button>
            <Button variant="outline" className="h-7 text-xs" onClick={() => { setBatchReviewMessage(""); setIsBatchRejectMode(false) }}>取消</Button>
          </div>
        </div>
      ) : null}

      {showKeyboardHints ? <KeyboardHintsPanel onClose={() => setShowKeyboardHints(false)} /> : null}
      {actionNotice ? (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground shadow-md">
          {actionNotice}
        </div>
      ) : null}
    </section>
  )
}

