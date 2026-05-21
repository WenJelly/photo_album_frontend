import { startTransition, useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  FileSearch,
  ImageIcon,
  Layers3,
  ListChecks,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

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
type ReviewStatsState = "loading" | "ready" | "error"

interface ReviewSearchState {
  content: string
  reviewStatus: ReviewStatusFilter
  uploadEnd: string
  uploadStart: string
}

interface ReviewDashboardStats {
  all: number
  approved: number
  pending: number
  rejected: number
  trendRecords: AdminPictureRecord[]
  yesterday: {
    all: number
    approved: number
    pending: number
    rejected: number
  }
}

interface MetricPanelConfig {
  icon: LucideIcon
  key: keyof Omit<ReviewDashboardStats, "trendRecords" | "yesterday">
  reviewStatus: ReviewStatusFilter
  title: string
  tone: string
}

const REVIEW_STATUS_LABELS: Record<number, string> = {
  0: "待审核",
  1: "已通过",
  2: "已拒绝",
}

const STATUS_FILTERS: Array<{ label: string; value: ReviewStatusFilter }> = [
  { label: "全部", value: -1 },
  { label: "待审核", value: 0 },
  { label: "已通过", value: 1 },
  { label: "已拒绝", value: 2 },
]

const METRIC_PANELS: MetricPanelConfig[] = [
  {
    key: "all",
    title: "全部",
    reviewStatus: -1,
    icon: BarChart3,
    tone: "text-[oklch(0.37_0.045_250)] bg-[oklch(0.92_0.026_250)]",
  },
  {
    key: "pending",
    title: "待审核",
    reviewStatus: 0,
    icon: Clock3,
    tone: "text-[oklch(0.48_0.095_68)] bg-[oklch(0.93_0.042_76)]",
  },
  {
    key: "approved",
    title: "已通过",
    reviewStatus: 1,
    icon: CheckCircle2,
    tone: "text-[oklch(0.42_0.09_158)] bg-[oklch(0.92_0.04_158)]",
  },
  {
    key: "rejected",
    title: "已拒绝",
    reviewStatus: 2,
    icon: XCircle,
    tone: "text-[oklch(0.48_0.12_24)] bg-[oklch(0.93_0.04_24)]",
  },
]

const EMPTY_STATS: ReviewDashboardStats = {
  all: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  trendRecords: [],
  yesterday: {
    all: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  },
}

const ADMIN_REVIEW_PAGE_SIZE = 20
const ADMIN_STATS_TREND_SIZE = 80
const TREND_DAYS = 7

function createDefaultSearchState(): ReviewSearchState {
  return {
    reviewStatus: -1,
    content: "",
    uploadStart: "",
    uploadEnd: "",
  }
}

function getReviewStatusLabel(reviewStatus?: number) {
  if (reviewStatus === undefined) {
    return "未知状态"
  }

  return REVIEW_STATUS_LABELS[reviewStatus] ?? "未知状态"
}

function getReviewStatusClass(reviewStatus?: number) {
  if (reviewStatus === 1) {
    return "border-[oklch(0.82_0.045_158)] bg-[oklch(0.96_0.02_158)] text-[oklch(0.39_0.09_158)]"
  }

  if (reviewStatus === 2) {
    return "border-[oklch(0.84_0.05_24)] bg-[oklch(0.96_0.022_24)] text-[oklch(0.44_0.11_24)]"
  }

  return "border-[oklch(0.82_0.05_76)] bg-[oklch(0.96_0.026_76)] text-[oklch(0.43_0.09_68)]"
}

function getPictureTitle(record: AdminPictureRecord) {
  return record.name?.trim() || `图片 ${record.id}`
}

function getUploaderDisplay(record: Pick<AdminPictureRecord, "user" | "userId">) {
  const userName = record.user?.userName?.trim()
  const userId = record.userId ?? record.user?.id

  if (userName) {
    return {
      primaryLabel: userName,
      secondaryLabel: userId ? `#${userId}` : null,
    }
  }

  if (userId) {
    return {
      primaryLabel: `用户 #${userId}`,
      secondaryLabel: null,
    }
  }

  return {
    primaryLabel: "未记录",
    secondaryLabel: null,
  }
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
  if (!value.trim()) {
    return undefined
  }

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

function getRecordTimestamp(record: AdminPictureRecord) {
  return record.createTime ?? record.editTime ?? record.updateTime
}

function parseRecordDate(value?: string) {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value.replace(" ", "T"))

  return Number.isNaN(timestamp) ? null : new Date(timestamp)
}

function formatDisplayDate(value?: string) {
  const date = parseRecordDate(value)

  if (!date) {
    return value ?? "-"
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatFileSize(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return "-"
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`
  }

  return `${Math.round(value)} B`
}

function formatDimensions(record: AdminPictureRecord) {
  if (!record.picWidth || !record.picHeight) {
    return "-"
  }

  return `${record.picWidth} × ${record.picHeight}`
}

function formatAspectRatio(record: AdminPictureRecord) {
  if (!record.picWidth || !record.picHeight) {
    return "-"
  }

  return (record.picWidth / record.picHeight).toFixed(2)
}

function getContentCompleteness(record: AdminPictureRecord) {
  const checks = [
    Boolean(record.name?.trim()),
    Boolean(record.introduction?.trim()),
    Boolean(record.category?.trim()),
    record.tags.length > 0,
    Boolean(record.picWidth && record.picHeight),
  ]

  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function getRiskSignals(record: AdminPictureRecord) {
  const signals: string[] = []

  if (!record.introduction?.trim()) {
    signals.push("缺少作品说明")
  }

  if (!record.category?.trim()) {
    signals.push("未设置分类")
  }

  if (!record.tags.length) {
    signals.push("缺少标签")
  }

  if (!record.picWidth || !record.picHeight) {
    signals.push("尺寸信息不完整")
  }

  if (record.reviewStatus === 2 && record.reviewMessage) {
    signals.push("已有拒绝意见")
  }

  return signals
}

function formatDateBoundary(date: Date, boundary: "start" | "end") {
  const next = new Date(date)

  if (boundary === "start") {
    next.setHours(0, 0, 0, 0)
  } else {
    next.setHours(23, 59, 59, 999)
  }

  const year = next.getFullYear()
  const month = String(next.getMonth() + 1).padStart(2, "0")
  const day = String(next.getDate()).padStart(2, "0")
  const hour = String(next.getHours()).padStart(2, "0")
  const minute = String(next.getMinutes()).padStart(2, "0")
  const second = String(next.getSeconds()).padStart(2, "0")

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function getYesterdayRange() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  return {
    start: formatDateBoundary(yesterday, "start"),
    end: formatDateBoundary(yesterday, "end"),
  }
}

async function loadReviewDashboardStats(): Promise<ReviewDashboardStats> {
  const yesterday = getYesterdayRange()
  const yesterdayParams = {
    editTimeStart: yesterday.start,
    editTimeEnd: yesterday.end,
    pageNum: 1,
    pageSize: 1,
  }

  const [
    all,
    pending,
    approved,
    rejected,
    yesterdayAll,
    yesterdayPending,
    yesterdayApproved,
    yesterdayRejected,
  ] = await Promise.all([
    listAdminPictures({ pageNum: 1, pageSize: ADMIN_STATS_TREND_SIZE }),
    listAdminPictures({ pageNum: 1, pageSize: 1, reviewStatus: 0 }),
    listAdminPictures({ pageNum: 1, pageSize: 1, reviewStatus: 1 }),
    listAdminPictures({ pageNum: 1, pageSize: 1, reviewStatus: 2 }),
    listAdminPictures(yesterdayParams),
    listAdminPictures({ ...yesterdayParams, reviewStatus: 0 }),
    listAdminPictures({ ...yesterdayParams, reviewStatus: 1 }),
    listAdminPictures({ ...yesterdayParams, reviewStatus: 2 }),
  ])

  return {
    all: all.total,
    pending: pending.total,
    approved: approved.total,
    rejected: rejected.total,
    trendRecords: all.list,
    yesterday: {
      all: yesterdayAll.total,
      pending: yesterdayPending.total,
      approved: yesterdayApproved.total,
      rejected: yesterdayRejected.total,
    },
  }
}

function buildTrendSeries(records: AdminPictureRecord[], reviewStatus?: number) {
  const today = new Date()
  const buckets = Array.from({ length: TREND_DAYS }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (TREND_DAYS - 1 - index))

    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      value: 0,
    }
  })

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  for (const record of records) {
    if (reviewStatus !== undefined && record.reviewStatus !== reviewStatus) {
      continue
    }

    const date = parseRecordDate(getRecordTimestamp(record))

    if (!date) {
      continue
    }

    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const bucket = bucketMap.get(key)

    if (bucket) {
      bucket.value += 1
    }
  }

  return buckets.map((bucket) => bucket.value)
}

function buildSparklinePath(values: number[]) {
  const width = 104
  const height = 34
  const maxValue = Math.max(...values, 1)
  const step = width / Math.max(values.length - 1, 1)
  const points = values.map((value, index) => {
    const x = index * step
    const y = height - (value / maxValue) * (height - 4) - 2

    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  return `M ${points.join(" L ")}`
}

function getDeltaCopy(current: number, yesterday: number) {
  const delta = current - yesterday

  if (delta > 0) {
    return `较昨日 +${delta}`
  }

  if (delta < 0) {
    return `较昨日 ${delta}`
  }

  return "较昨日持平"
}

function getDeltaTone(current: number, yesterday: number) {
  const delta = current - yesterday

  if (delta > 0) {
    return "text-[oklch(0.42_0.09_158)]"
  }

  if (delta < 0) {
    return "text-[oklch(0.48_0.12_24)]"
  }

  return "text-muted-foreground"
}

function EmptySelection() {
  return (
    <div className="admin-review-glass-panel admin-review-glass-panel--quiet flex min-h-[30rem] items-center justify-center border-dashed px-6 text-center text-sm text-muted-foreground">
      从下方列表选择一张图片，审核信息会在这里展开。
    </div>
  )
}

function MetricPanel({
  active,
  config,
  onSelect,
  stats,
  trend,
}: {
  active: boolean
  config: MetricPanelConfig
  onSelect: (status: ReviewStatusFilter) => void
  stats: ReviewDashboardStats
  trend: number[]
}) {
  const Icon = config.icon
  const currentValue = stats[config.key]
  const yesterdayValue = stats.yesterday[config.key]
  const sparklinePath = buildSparklinePath(trend)

  return (
    <button
      type="button"
      onClick={() => onSelect(config.reviewStatus)}
      className={cn(
        "admin-review-glass-card group min-h-32 p-4 text-left transition-colors duration-200 hover:border-foreground/18 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
        active && "border-foreground/24",
      )}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{config.title}</p>
        </div>
        <span className={cn("inline-flex size-9 items-center justify-center rounded-xl", config.tone)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold tabular-nums tracking-[-0.04em] text-foreground">{currentValue}</p>
          <p className={cn("mt-2 text-xs font-medium", getDeltaTone(currentValue, yesterdayValue))}>
            {getDeltaCopy(currentValue, yesterdayValue)}
          </p>
        </div>
        <svg
          viewBox="0 0 104 34"
          role="img"
          aria-label={`${config.title} 7日趋势图`}
          className="h-10 w-28 overflow-visible"
        >
          <path d="M 0 32 L 104 32" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
          <path
            d={sparklinePath}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            className="text-foreground/70"
          />
        </svg>
      </div>
    </button>
  )
}

function ReviewProgress({ record, recheck }: { recheck: boolean; record: AdminPictureRecord }) {
  const steps = [
    {
      label: "接收作品",
      detail: formatDisplayDate(record.createTime ?? record.updateTime),
      complete: true,
    },
    {
      label: "内容分析",
      detail: `${getContentCompleteness(record)}% 完整度`,
      complete: true,
    },
    {
      label: recheck ? "复审关注" : "人工审核",
      detail: recheck ? "已加入复审关注" : getReviewStatusLabel(record.reviewStatus),
      complete: record.reviewStatus !== 0 || recheck,
    },
    {
      label: "发布或退回",
      detail: record.reviewStatus === 1 ? "已进入图库" : record.reviewStatus === 2 ? "已退回" : "等待操作",
      complete: record.reviewStatus !== 0,
    },
  ]

  return (
    <ol
      data-testid="admin-review-workflow-rail"
      className="admin-review-glass-panel admin-review-glass-panel--quiet grid gap-0 overflow-hidden p-2 md:grid-cols-4"
    >
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={cn(
            "relative flex min-w-0 items-center gap-3 px-3 py-2.5 md:after:absolute md:after:right-0 md:after:top-1/2 md:after:h-px md:after:w-8 md:after:translate-x-1/2 md:after:bg-border/70",
            index === steps.length - 1 && "md:after:hidden",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                step.complete
                  ? "bg-foreground text-background"
                  : "border border-border/80 bg-background text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{step.label}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function DetailFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1 truncate text-sm font-medium text-foreground">{value}</dd>
      </div>
    </div>
  )
}

function ThumbnailListItem({
  isActive,
  isSelected,
  onOpen,
  onToggleSelect,
  record,
}: {
  isActive: boolean
  isSelected: boolean
  onOpen: (record: AdminPictureRecord) => void
  onToggleSelect: (id: string, isChecked: boolean) => void
  record: AdminPictureRecord
}) {
  return (
    <article
      className={cn(
        "admin-review-glass-card group w-[16.5rem] shrink-0 p-3 transition-colors duration-200",
        isActive ? "border-foreground/28" : "hover:border-foreground/18",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(record)}
        className="block w-full overflow-hidden rounded-[1rem] bg-secondary/60 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
      >
        <img
          src={record.thumbnailUrl ?? record.url}
          alt={getPictureTitle(record)}
          width={260}
          height={168}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable="false"
          className="aspect-[13/8] w-full object-cover transition duration-300 group-hover:scale-[1.025]"
        />
      </button>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(record)}
            className="max-w-full truncate text-left text-sm font-medium text-foreground transition hover:text-foreground/72 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
          >
            {getPictureTitle(record)}
          </button>
          <p className="mt-1 truncate text-xs text-muted-foreground">{record.category || "未分类"}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[0.7rem] font-medium",
            getReviewStatusClass(record.reviewStatus),
          )}
        >
          {getReviewStatusLabel(record.reviewStatus)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            aria-label={`选择图片 ${record.id}`}
            checked={isSelected}
            onChange={(event) => onToggleSelect(record.id, event.target.checked)}
            className="size-4 rounded border-border/80"
          />
          批量
        </label>
        <p className="text-xs text-muted-foreground">{formatDisplayDate(getRecordTimestamp(record))}</p>
      </div>
    </article>
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
  const [recheckIds, setRecheckIds] = useState<string[]>([])
  const [selectedPicture, setSelectedPicture] = useState<AdminPictureRecord | null>(null)
  const [selectedPictureError, setSelectedPictureError] = useState<string | null>(null)
  const [detailReviewMessage, setDetailReviewMessage] = useState("")
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [isSubmittingDetailAction, setIsSubmittingDetailAction] = useState(false)
  const [isDeletingSelectedPicture, setIsDeletingSelectedPicture] = useState(false)
  const [isBatchRejectMode, setIsBatchRejectMode] = useState(false)
  const [batchReviewMessage, setBatchReviewMessage] = useState("")
  const [isSubmittingBatchAction, setIsSubmittingBatchAction] = useState(false)
  const [statsVersion, setStatsVersion] = useState(0)
  const [statsState, setStatsState] = useState<ReviewStatsState>("loading")
  const [dashboardStats, setDashboardStats] = useState<ReviewDashboardStats>(EMPTY_STATS)

  useEffect(() => {
    if (currentUserRole !== "admin") {
      return
    }

    let isCancelled = false

    const load = async () => {
      setPageState("loading")
      setErrorMessage(null)

      try {
        const result = await listAdminPictures(filters)

        if (isCancelled) {
          return
        }

        setRecords(result.list)
        setTotalRecords(result.total)

        const visibleIdSet = new Set(result.list.map((record) => record.id))
        setSelectedIds((current) => current.filter((id) => visibleIdSet.has(id)))
        setSelectedPicture((current) => {
          if (current) {
            const refreshedRecord = result.list.find((record) => record.id === current.id)

            if (refreshedRecord) {
              return mergeAdminPictureRecord(current, refreshedRecord)
            }
          }

          return result.list[0] ?? null
        })
        setPageState("ready")
      } catch (error) {
        if (isCancelled) {
          return
        }

        setPageState("error")
        setErrorMessage(error instanceof Error ? error.message : "审核列表暂时无法加载。")
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [currentUserRole, filters])

  useEffect(() => {
    if (currentUserRole !== "admin") {
      return
    }

    let isCancelled = false

    const load = async () => {
      setStatsState("loading")

      try {
        const nextStats = await loadReviewDashboardStats()

        if (isCancelled) {
          return
        }

        setDashboardStats(nextStats)
        setStatsState("ready")
      } catch {
        if (isCancelled) {
          return
        }

        setDashboardStats(EMPTY_STATS)
        setStatsState("error")
      }
    }

    void load()

    return () => {
      isCancelled = true
    }
  }, [currentUserRole, statsVersion])

  const pageSize = filters.pageSize ?? ADMIN_REVIEW_PAGE_SIZE
  const currentPageNum = filters.pageNum ?? 1
  const pageCount = useMemo(() => Math.max(1, Math.ceil(totalRecords / pageSize)), [pageSize, totalRecords])
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const recheckIdSet = useMemo(() => new Set(recheckIds), [recheckIds])
  const selectedCount = selectedIds.length
  const selectedPictureTitle = selectedPicture ? getPictureTitle(selectedPicture) : ""
  const selectedPictureCompleteness = selectedPicture ? getContentCompleteness(selectedPicture) : 0
  const selectedPictureRisks = selectedPicture ? getRiskSignals(selectedPicture) : []
  const selectedPictureUploader = selectedPicture ? getUploaderDisplay(selectedPicture) : null
  const selectedPictureInBatch = selectedPicture ? selectedIdSet.has(selectedPicture.id) : false
  const selectedPictureRecheck = selectedPicture ? recheckIdSet.has(selectedPicture.id) : false
  const activeStatusFilter = appliedSearch.reviewStatus
  const trendSeries = useMemo(
    () => ({
      all: buildTrendSeries(dashboardStats.trendRecords),
      pending: buildTrendSeries(dashboardStats.trendRecords, 0),
      approved: buildTrendSeries(dashboardStats.trendRecords, 1),
      rejected: buildTrendSeries(dashboardStats.trendRecords, 2),
    }),
    [dashboardStats.trendRecords],
  )

  const applySearch = useCallback((nextSearch: ReviewSearchState, pageNum = 1) => {
    setActionNotice(null)
    setAppliedSearch(nextSearch)
    startTransition(() => {
      setFilters(buildAdminReviewFilters(nextSearch, pageNum))
    })
  }, [])

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      applySearch(searchDraft, 1)
    },
    [applySearch, searchDraft],
  )

  const handleResetSearch = useCallback(() => {
    const nextSearch = createDefaultSearchState()

    setSearchDraft(nextSearch)
    applySearch(nextSearch, 1)
  }, [applySearch])

  const handleMetricFilterSelect = useCallback(
    (reviewStatus: ReviewStatusFilter) => {
      const nextSearch = {
        ...searchDraft,
        reviewStatus,
      }

      setSearchDraft(nextSearch)
      applySearch(nextSearch, 1)
    },
    [applySearch, searchDraft],
  )

  const handlePageChange = useCallback(
    (nextPageNum: number) => {
      const normalizedPageNum = Math.min(Math.max(1, nextPageNum), pageCount)

      if (normalizedPageNum === currentPageNum) {
        return
      }

      applySearch(appliedSearch, normalizedPageNum)
    },
    [appliedSearch, applySearch, currentPageNum, pageCount],
  )

  const handleToggleSelect = useCallback((id: string, isChecked: boolean) => {
    setSelectedIds((current) => {
      if (isChecked) {
        return current.includes(id) ? current : [...current, id]
      }

      return current.filter((value) => value !== id)
    })
  }, [])

  const handleOpenDetail = useCallback((record: AdminPictureRecord) => {
    setSelectedPicture(record)
    setSelectedPictureError(null)
    setDetailReviewMessage(record.reviewMessage ?? "")
    setActionNotice(null)
  }, [])

  const applyRecordUpdate = useCallback(
    (updatedRecord: AdminPictureRecord) => {
      setRecords((current) => {
        const nextRecords = current.map((record) =>
          record.id === updatedRecord.id ? mergeAdminPictureRecord(record, updatedRecord) : record,
        )
        const statusParam = getStatusParam(appliedSearch.reviewStatus)

        return statusParam === undefined
          ? nextRecords
          : nextRecords.filter((record) => record.reviewStatus === statusParam)
      })
      setSelectedPicture((current) =>
        current?.id === updatedRecord.id ? mergeAdminPictureRecord(current, updatedRecord) : current,
      )
    },
    [appliedSearch.reviewStatus],
  )

  const submitReviewAction = useCallback(
    async (params: ReviewPictureParams) => {
      const updatedRecord = await reviewPicture(params)
      applyRecordUpdate(updatedRecord)

      return updatedRecord
    },
    [applyRecordUpdate],
  )

  const handleDetailReview = useCallback(
    async (reviewStatus: 1 | 2) => {
      if (!selectedPicture) {
        return
      }

      const normalizedMessage = detailReviewMessage.trim()

      if (reviewStatus === 2 && !normalizedMessage) {
        setSelectedPictureError("拒绝时请填写审核意见。")
        return
      }

      setIsSubmittingDetailAction(true)
      setSelectedPictureError(null)
      setActionNotice(null)

      try {
        await submitReviewAction({
          id: selectedPicture.id,
          reviewStatus,
          reviewMessage: normalizedMessage || undefined,
        })
        setStatsVersion((current) => current + 1)
        setActionNotice(`已完成${reviewStatus === 1 ? "通过" : "拒绝"}审核。`)
      } catch (error) {
        setSelectedPictureError(error instanceof Error ? error.message : "审核操作失败。")
      } finally {
        setIsSubmittingDetailAction(false)
      }
    },
    [detailReviewMessage, selectedPicture, submitReviewAction],
  )

  const handleBatchReview = useCallback(
    async (reviewStatus: 1 | 2) => {
      if (!selectedIds.length) {
        return
      }

      const normalizedMessage = batchReviewMessage.trim()

      if (reviewStatus === 2 && !normalizedMessage) {
        setActionNotice("批量拒绝时请填写统一审核意见。")
        return
      }

      setIsSubmittingBatchAction(true)
      setActionNotice(null)

      let successCount = 0

      try {
        for (const id of selectedIds) {
          await submitReviewAction({
            id,
            reviewStatus,
            reviewMessage: normalizedMessage || undefined,
          })
          successCount += 1
        }

        setSelectedIds([])
        setBatchReviewMessage("")
        setIsBatchRejectMode(false)
        setActionNotice(`批量处理完成：成功 ${successCount} 张。`)
      } catch (error) {
        setActionNotice(error instanceof Error ? error.message : "批量审核失败。")
      } finally {
        if (successCount > 0) {
          setStatsVersion((current) => current + 1)
        }

        setIsSubmittingBatchAction(false)
      }
    },
    [batchReviewMessage, selectedIds, submitReviewAction],
  )

  const handleDeleteSelectedPicture = useCallback(async () => {
    if (!selectedPicture) {
      return
    }

    if (!window.confirm(DELETE_PICTURE_CONFIRM_MESSAGE)) {
      return
    }

    setIsDeletingSelectedPicture(true)
    setSelectedPictureError(null)
    setActionNotice(null)

    try {
      const deletedPicture = await deletePicture(selectedPicture.id)
      const deletedId = deletedPicture.id

      setRecords((current) => current.filter((record) => record.id !== deletedId))
      setSelectedIds((current) => current.filter((id) => id !== deletedId))
      setRecheckIds((current) => current.filter((id) => id !== deletedId))
      setSelectedPicture((current) => {
        if (current?.id !== deletedId) {
          return current
        }

        return records.find((record) => record.id !== deletedId) ?? null
      })
      setDetailReviewMessage("")
      setStatsVersion((current) => current + 1)
      setActionNotice(`已删除图片 ${deletedId}。`)
    } catch (error) {
      setSelectedPictureError(error instanceof Error ? error.message : "删除图片失败。")
    } finally {
      setIsDeletingSelectedPicture(false)
    }
  }, [records, selectedPicture])

  const handleToggleSelectedPictureBatch = useCallback(() => {
    if (!selectedPicture) {
      return
    }

    handleToggleSelect(selectedPicture.id, !selectedIdSet.has(selectedPicture.id))
  }, [handleToggleSelect, selectedIdSet, selectedPicture])

  const handleMarkForRecheck = useCallback(() => {
    if (!selectedPicture) {
      return
    }

    setRecheckIds((current) => (current.includes(selectedPicture.id) ? current : [...current, selectedPicture.id]))
    setActionNotice("已加入复审关注，后续可继续通过或拒绝。")
  }, [selectedPicture])

  const handleOpenOriginal = useCallback(() => {
    if (!selectedPicture) {
      return
    }

    window.open(selectedPicture.url, "_blank", "noopener,noreferrer")
  }, [selectedPicture])

  if (currentUserRole !== "admin") {
    return (
      <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 md:px-6 md:pb-16 md:pt-6">
        <div className="admin-review-glass-panel px-6 py-16 text-center text-sm text-muted-foreground">
          请使用管理员账号访问图片审核页面。
        </div>
      </section>
    )
  }

  return (
    <section
      data-testid="admin-review-shell"
      className="admin-review-waterglass mx-auto max-w-[1480px] px-4 pb-10 pt-4 md:px-6 md:pb-16 md:pt-6"
    >
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow-label">Admin Review</p>
          <h1 className="mt-3 text-[2.25rem] font-semibold leading-none tracking-[-0.035em] text-foreground md:text-[2.7rem]">
            图片审核管理中心
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="admin-review-glass-chip inline-flex items-center gap-2 px-3.5 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {statsState === "error" ? "统计暂不可用" : `当前结果 ${totalRecords} 张`}
          </span>
          <span className="admin-review-glass-chip inline-flex items-center gap-2 px-3.5 py-2 text-xs text-muted-foreground">
            <ListChecks className="size-3.5" aria-hidden="true" />
            已选 {selectedCount} 张
          </span>
        </div>
      </header>

      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {METRIC_PANELS.map((panel) => (
          <MetricPanel
            key={panel.key}
            active={activeStatusFilter === panel.reviewStatus}
            config={panel}
            stats={statsState === "ready" ? dashboardStats : EMPTY_STATS}
            trend={trendSeries[panel.key]}
            onSelect={handleMetricFilterSelect}
          />
        ))}
      </div>

      {actionNotice ? (
        <div className="admin-review-glass-panel admin-review-glass-panel--quiet mb-5 px-4 py-3 text-sm text-[oklch(0.35_0.075_158)]">
          {actionNotice}
        </div>
      ) : null}

      <div
        data-testid="admin-review-focus-layout"
        className="mb-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1.58fr)_minmax(320px,0.42fr)]"
      >
        <section data-testid="admin-review-glass-panel" className="admin-review-glass-panel p-3 md:p-4">
          {selectedPicture ? (
            <div
              data-testid="admin-review-hero-frame"
              className="overflow-hidden rounded-[1.25rem] bg-secondary/55"
              style={{
                aspectRatio:
                  selectedPicture.picWidth && selectedPicture.picHeight
                    ? `${selectedPicture.picWidth} / ${selectedPicture.picHeight}`
                    : "16 / 10",
              }}
            >
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
                className="max-h-[42rem] w-full object-contain"
              />
            </div>
          ) : (
            <EmptySelection />
          )}
        </section>

        <section data-testid="admin-review-glass-panel" className="admin-review-glass-panel p-4">
          <div data-testid="admin-review-info-rail" className="flex min-w-0 flex-col gap-4">
            {selectedPicture ? (
              <>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        getReviewStatusClass(selectedPicture.reviewStatus),
                      )}
                    >
                      {getReviewStatusLabel(selectedPicture.reviewStatus)}
                    </span>
                    <span className="text-xs text-muted-foreground">#{selectedPicture.id}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold leading-tight tracking-[-0.03em] text-foreground">
                    {selectedPictureTitle}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
                    {selectedPicture.introduction || "暂无作品说明。"}
                  </p>
                </div>

                <dl className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                  <DetailFact
                    icon={UserRound}
                    label="作者"
                    value={selectedPictureUploader ? selectedPictureUploader.primaryLabel : "-"}
                  />
                  <DetailFact icon={ImageIcon} label="分类" value={selectedPicture.category || "未分类"} />
                  <DetailFact
                    icon={CalendarClock}
                    label="上传时间"
                    value={formatDisplayDate(selectedPicture.createTime)}
                  />
                  <DetailFact
                    icon={Eye}
                    label="浏览 / 点赞"
                    value={`${selectedPicture.viewCount ?? 0} / ${selectedPicture.likeCount ?? 0}`}
                  />
                </dl>

                <div className="border-t border-border/60 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="eyebrow-label">Analysis</p>
                      <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">
                        图片分析
                      </h2>
                    </div>
                    <span className="inline-flex size-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <FileSearch className="size-4" aria-hidden="true" />
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-end justify-between gap-4">
                      <p className="text-sm font-medium text-foreground">内容完整度</p>
                      <p className="text-2xl font-semibold tabular-nums tracking-[-0.04em] text-foreground">
                        {selectedPictureCompleteness}%
                      </p>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary/70">
                      <div
                        className="h-full rounded-full bg-[oklch(0.45_0.09_158)] transition-[width] duration-300"
                        style={{ width: `${selectedPictureCompleteness}%` }}
                      />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="admin-review-glass-panel admin-review-glass-panel--quiet p-3">
                      <dt className="text-xs text-muted-foreground">尺寸</dt>
                      <dd className="mt-1 font-medium text-foreground">{formatDimensions(selectedPicture)}</dd>
                    </div>
                    <div className="admin-review-glass-panel admin-review-glass-panel--quiet p-3">
                      <dt className="text-xs text-muted-foreground">比例</dt>
                      <dd className="mt-1 font-medium text-foreground">{formatAspectRatio(selectedPicture)}</dd>
                    </div>
                    <div className="admin-review-glass-panel admin-review-glass-panel--quiet p-3">
                      <dt className="text-xs text-muted-foreground">格式</dt>
                      <dd className="mt-1 font-medium uppercase text-foreground">{selectedPicture.picFormat || "-"}</dd>
                    </div>
                    <div className="admin-review-glass-panel admin-review-glass-panel--quiet p-3">
                      <dt className="text-xs text-muted-foreground">文件</dt>
                      <dd className="mt-1 font-medium text-foreground">{formatFileSize(selectedPicture.picSize)}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">审核提示</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedPictureRisks.length ? (
                      selectedPictureRisks.map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-[oklch(0.84_0.05_76)] bg-[oklch(0.96_0.026_76)] px-3 py-1 text-xs text-[oklch(0.43_0.09_68)]"
                        >
                          {signal}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-[oklch(0.82_0.045_158)] bg-[oklch(0.96_0.02_158)] px-3 py-1 text-xs text-[oklch(0.35_0.075_158)]">
                        基础信息完整
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">标签</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedPicture.tags.length ? (
                      selectedPicture.tags.map((tag) => (
                        <span key={tag} className="tag-chip-muted">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">暂无标签</span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[1rem] border border-dashed border-border/80 bg-secondary/28 px-4 py-10 text-center text-sm text-muted-foreground">
                选择图片后显示元数据、内容完整度和审核提示。
              </div>
            )}
          </div>
        </section>
      </div>

      <section data-testid="admin-review-glass-panel" className="admin-review-glass-panel mb-5 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <Layers3 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">当前审核流程</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedPicture ? `正在处理：${selectedPictureTitle}` : "请选择下方图片开始审核。"}
                </p>
              </div>
            </div>
            {selectedPicture ? (
              <div className="mt-5">
                <ReviewProgress record={selectedPicture} recheck={selectedPictureRecheck} />
              </div>
            ) : null}
          </div>

          <div className="w-full xl:w-[26rem]">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-foreground">审核意见</span>
              <textarea
                value={detailReviewMessage}
                onChange={(event) => setDetailReviewMessage(event.target.value)}
                placeholder="拒绝时必须填写原因，也可记录通过备注。"
                className="admin-review-glass-field min-h-20 w-full resize-none px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-3 focus:ring-ring/20"
              />
            </label>
            {selectedPictureError ? (
              <div className="admin-review-glass-panel admin-review-glass-panel--quiet mt-3 px-4 py-3 text-sm text-destructive">
                {selectedPictureError}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void handleDetailReview(1)} disabled={!selectedPicture || isSubmittingDetailAction}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                通过
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDetailReview(2)}
                disabled={!selectedPicture || isSubmittingDetailAction}
              >
                <XCircle className="size-4" aria-hidden="true" />
                拒绝
              </Button>
              <Button variant="secondary" onClick={handleToggleSelectedPictureBatch} disabled={!selectedPicture}>
                <Layers3 className="size-4" aria-hidden="true" />
                {selectedPictureInBatch ? "移出批量" : "加入批量"}
              </Button>
              <Button variant="outline" onClick={handleMarkForRecheck} disabled={!selectedPicture}>
                <RotateCcw className="size-4" aria-hidden="true" />
                复审
              </Button>
              <Button variant="outline" onClick={handleOpenOriginal} disabled={!selectedPicture}>
                <Eye className="size-4" aria-hidden="true" />
                查看原图
              </Button>
            </div>
            {selectedPicture ? (
              <div className="mt-3">
                <Button
                  variant="destructive"
                  onClick={() => void handleDeleteSelectedPicture()}
                  disabled={isDeletingSelectedPicture}
                >
                  删除图片
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {selectedCount > 0 ? (
          <div className="admin-review-glass-panel admin-review-glass-panel--quiet mt-5 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-foreground">已加入批量 {selectedCount} 张图片</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void handleBatchReview(1)} disabled={isSubmittingBatchAction}>
                  批量通过
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setIsBatchRejectMode((current) => !current)}
                  disabled={isSubmittingBatchAction}
                >
                  批量拒绝
                </Button>
              </div>
            </div>
            {isBatchRejectMode ? (
              <div className="mt-4 space-y-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">批量审核意见</span>
                  <textarea
                    value={batchReviewMessage}
                    onChange={(event) => setBatchReviewMessage(event.target.value)}
                    placeholder="批量拒绝时必须填写统一原因。"
                    className="admin-review-glass-field min-h-20 w-full resize-none px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-3 focus:ring-ring/20"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" onClick={() => void handleBatchReview(2)} disabled={isSubmittingBatchAction}>
                    确认批量拒绝
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBatchReviewMessage("")
                      setIsBatchRejectMode(false)
                    }}
                    disabled={isSubmittingBatchAction}
                  >
                    取消
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section data-testid="admin-review-glass-panel" className="admin-review-glass-panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="eyebrow-label">Review Queue</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-foreground">图片列表</h2>
          </div>
          <form onSubmit={handleSearchSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[10rem_18rem_12rem_12rem_auto_auto]">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">状态</span>
              <select
                aria-label="状态搜索"
                value={searchDraft.reviewStatus}
                onChange={(event) =>
                  setSearchDraft((current) => ({
                    ...current,
                    reviewStatus: Number(event.target.value) as ReviewStatusFilter,
                  }))
                }
                className="admin-review-glass-field h-9 w-full px-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-3 focus:ring-ring/20"
              >
                {STATUS_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">内容</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  aria-label="内容搜索"
                  value={searchDraft.content}
                  onChange={(event) => setSearchDraft((current) => ({ ...current, content: event.target.value }))}
                  placeholder="标题、作者、分类、标签"
                  className="admin-review-glass-field h-9 w-full pl-9 pr-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-3 focus:ring-ring/20"
                />
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">上传开始</span>
              <input
                aria-label="上传开始时间"
                type="datetime-local"
                value={searchDraft.uploadStart}
                onChange={(event) => setSearchDraft((current) => ({ ...current, uploadStart: event.target.value }))}
                className="admin-review-glass-field h-9 w-full px-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-3 focus:ring-ring/20"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">上传结束</span>
              <input
                aria-label="上传结束时间"
                type="datetime-local"
                value={searchDraft.uploadEnd}
                onChange={(event) => setSearchDraft((current) => ({ ...current, uploadEnd: event.target.value }))}
                className="admin-review-glass-field h-9 w-full px-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-3 focus:ring-ring/20"
              />
            </label>
            <Button type="submit" className="self-end">
              <Search className="size-4" aria-hidden="true" />
              搜索
            </Button>
            <Button type="button" variant="outline" onClick={handleResetSearch} className="self-end">
              重置
            </Button>
          </form>
        </div>

        {pageState === "loading" ? (
          <div className="admin-review-glass-panel admin-review-glass-panel--quiet mt-5 px-6 py-12 text-center text-sm text-muted-foreground">
            正在加载审核列表...
          </div>
        ) : null}

        {pageState === "error" ? (
          <div className="admin-review-glass-panel admin-review-glass-panel--quiet mt-5 px-6 py-6 text-sm text-destructive">
            {errorMessage ?? "审核列表暂时无法加载。"}
          </div>
        ) : null}

        {pageState === "ready" ? (
          <>
            {records.length ? (
              <div className="mt-5 overflow-x-auto pb-2">
                <div className="flex min-w-full gap-4">
                  {records.map((record) => (
                    <ThumbnailListItem
                      key={record.id}
                      record={record}
                      isActive={selectedPicture?.id === record.id}
                      isSelected={selectedIdSet.has(record.id)}
                      onOpen={handleOpenDetail}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="admin-review-glass-panel admin-review-glass-panel--quiet mt-5 border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
                当前搜索条件下没有图片。
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 border-t border-border/70 pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
              <p>
                第 {currentPageNum} / {pageCount} 页，共 {totalRecords} 张
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => handlePageChange(currentPageNum - 1)} disabled={currentPageNum <= 1}>
                  上一页
                </Button>
                <Button variant="outline" onClick={() => handlePageChange(currentPageNum + 1)} disabled={currentPageNum >= pageCount}>
                  下一页
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </section>
  )
}
