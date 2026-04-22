import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  getAdminPictureDetail,
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

const REVIEW_STATUS_LABELS: Record<number, string> = {
  0: "待审核",
  1: "已通过",
  2: "已拒绝",
}

const STATUS_FILTERS: Array<{ label: string; value?: number }> = [
  { label: "全部", value: undefined },
  { label: "待审核", value: 0 },
  { label: "已通过", value: 1 },
  { label: "已拒绝", value: 2 },
]

function getReviewStatusLabel(reviewStatus?: number) {
  if (reviewStatus === undefined) {
    return "未知状态"
  }

  return REVIEW_STATUS_LABELS[reviewStatus] ?? "未知状态"
}

function getStatusBadgeClass(reviewStatus?: number) {
  if (reviewStatus === 1) {
    return "bg-emerald-500/12 text-emerald-700"
  }

  if (reviewStatus === 2) {
    return "bg-rose-500/12 text-rose-700"
  }

  return "bg-amber-500/12 text-amber-700"
}

function matchesStatusFilter(record: AdminPictureRecord, reviewStatus?: number) {
  return reviewStatus === undefined || record.reviewStatus === reviewStatus
}

const ADMIN_THUMBNAIL_SIZE = 56
const ADMIN_DETAIL_PREVIEW_HEIGHT = 512
const ADMIN_REVIEW_PAGE_SIZE = 20

function buildAdminReviewFilters(reviewStatus: number | undefined = 0): ListAdminPicturesParams {
  return {
    pageNum: 1,
    pageSize: ADMIN_REVIEW_PAGE_SIZE,
    reviewStatus,
  }
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
    primaryLabel: "-",
    secondaryLabel: null,
  }
}

function mergeAdminPictureRecord(currentRecord: AdminPictureRecord, nextRecord: AdminPictureRecord): AdminPictureRecord {
  return {
    ...currentRecord,
    ...nextRecord,
    userId: nextRecord.userId ?? currentRecord.userId,
    user: nextRecord.user ?? currentRecord.user,
  }
}

function UploaderSummary({ record }: { record: Pick<AdminPictureRecord, "user" | "userId"> }) {
  const { primaryLabel, secondaryLabel } = getUploaderDisplay(record)

  return (
    <div className="space-y-1">
      <p className="text-foreground">{primaryLabel}</p>
      {secondaryLabel ? <p className="text-xs text-muted-foreground">{secondaryLabel}</p> : null}
    </div>
  )
}

interface AdminPictureRowProps {
  isSelected: boolean
  onOpenDetail: (record: AdminPictureRecord) => void
  onToggleSelect: (id: string, isChecked: boolean) => void
  record: AdminPictureRecord
}

const AdminPictureRow = memo(function AdminPictureRow({
  isSelected,
  onOpenDetail,
  onToggleSelect,
  record,
}: AdminPictureRowProps) {
  return (
    <tr key={record.id} className="align-top">
      <td className="px-4 py-4">
        <input
          type="checkbox"
          aria-label={`选择图片 ${record.id}`}
          checked={isSelected}
          onChange={(event) => onToggleSelect(record.id, event.target.checked)}
          className="size-4 rounded border-border/80"
        />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="size-14 overflow-hidden rounded-2xl bg-secondary/50">
            <img
              src={record.thumbnailUrl ?? record.url}
              alt={record.name ?? `picture-${record.id}`}
              width={ADMIN_THUMBNAIL_SIZE}
              height={ADMIN_THUMBNAIL_SIZE}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              draggable="false"
              className="size-full object-cover"
            />
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => onOpenDetail(record)}
              className="text-left font-medium text-foreground transition hover:text-foreground/72"
              aria-label={`查看图片 ${record.name ?? record.id} 的审核详情`}
            >
              {record.name ?? `图片 ${record.id}`}
            </button>
            <p className="text-xs text-muted-foreground">#{record.id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-muted-foreground">{record.category || "未分类"}</td>
      <td className="px-4 py-4 align-middle">
        <UploaderSummary record={record} />
      </td>
      <td className="px-4 py-4">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            getStatusBadgeClass(record.reviewStatus),
          )}
        >
          {getReviewStatusLabel(record.reviewStatus)}
        </span>
      </td>
      <td className="px-4 py-4 text-muted-foreground">{record.updateTime ?? "-"}</td>
    </tr>
  )
})

export function AdminReviewPage({ currentUserRole }: AdminReviewPageProps) {
  const detailCacheRef = useRef(new Map<string, AdminPictureRecord>())
  const [filters, setFilters] = useState<ListAdminPicturesParams>(() => buildAdminReviewFilters())
  const [clientPageNum, setClientPageNum] = useState(1)
  const [isClientPaginating, setIsClientPaginating] = useState(false)
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
        const requestedPageSize = filters.pageSize ?? ADMIN_REVIEW_PAGE_SIZE
        const shouldUseClientPagination = result.list.length > requestedPageSize

        if (isCancelled) {
          return
        }

        setClientPageNum((currentPageNum) =>
          shouldUseClientPagination ? Math.min(currentPageNum, Math.max(1, Math.ceil(result.list.length / requestedPageSize))) : 1,
        )
        setIsClientPaginating(shouldUseClientPagination)
        setRecords(result.list)
        setTotalRecords(shouldUseClientPagination ? result.list.length : result.total)
        const visibleIdSet = new Set(result.list.map((record) => record.id))
        setSelectedIds((current) => current.filter((id) => visibleIdSet.has(id)))
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

  const pageSize = filters.pageSize ?? ADMIN_REVIEW_PAGE_SIZE
  const currentPageNum = isClientPaginating ? clientPageNum : (filters.pageNum ?? 1)
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(Math.max(totalRecords, records.length) / pageSize)),
    [pageSize, records.length, totalRecords],
  )
  const visibleRecords = useMemo(() => {
    if (!isClientPaginating) {
      return records
    }

    const start = (currentPageNum - 1) * pageSize

    return records.slice(start, start + pageSize)
  }, [currentPageNum, isClientPaginating, pageSize, records])

  const summaryText = useMemo(() => {
    const effectiveTotal = Math.max(totalRecords, records.length)

    if (!effectiveTotal) {
      return "当前筛选下没有图片。"
    }

    return `共 ${effectiveTotal} 张图片`
  }, [records.length, totalRecords])

  const selectedCount = selectedIds.length
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const applyRecordUpdate = useCallback(
    (updatedRecord: AdminPictureRecord) => {
      const currentRecord =
        detailCacheRef.current.get(updatedRecord.id) ??
        (selectedPicture?.id === updatedRecord.id ? selectedPicture : undefined) ??
        records.find((record) => record.id === updatedRecord.id)
      const mergedRecord = currentRecord ? mergeAdminPictureRecord(currentRecord, updatedRecord) : updatedRecord

      detailCacheRef.current.set(mergedRecord.id, mergedRecord)
      setRecords((current) => {
        const nextRecords = current.map((record) =>
          record.id === updatedRecord.id ? mergeAdminPictureRecord(record, updatedRecord) : record,
        )

        return filters.reviewStatus === undefined
          ? nextRecords
          : nextRecords.filter((record) => matchesStatusFilter(record, filters.reviewStatus))
      })
      setSelectedPicture((current) =>
        current?.id === updatedRecord.id ? mergeAdminPictureRecord(current, updatedRecord) : current,
      )
    },
    [filters.reviewStatus, records, selectedPicture],
  )

  const handleStatusFilterChange = useCallback((reviewStatus?: number) => {
    setActionNotice(null)
    setClientPageNum(1)
    setIsClientPaginating(false)
    startTransition(() => {
      setFilters(buildAdminReviewFilters(reviewStatus))
    })
  }, [])

  const handlePageChange = useCallback(
    (nextPageNum: number) => {
      const normalizedPageNum = Math.min(Math.max(1, nextPageNum), pageCount)

      if (normalizedPageNum === currentPageNum) {
        return
      }

      setActionNotice(null)

      if (isClientPaginating) {
        setClientPageNum(normalizedPageNum)
        return
      }

      startTransition(() => {
        setFilters((currentFilters) => ({
          ...currentFilters,
          pageNum: normalizedPageNum,
        }))
      })
    },
    [currentPageNum, isClientPaginating, pageCount],
  )

  const handleToggleSelect = useCallback((id: string, isChecked: boolean) => {
    setSelectedIds((current) => {
      if (isChecked) {
        return current.includes(id) ? current : [...current, id]
      }

      return current.filter((value) => value !== id)
    })
  }, [])

  const handleOpenDetail = useCallback(async (record: AdminPictureRecord) => {
    const cachedOrCurrentRecord = detailCacheRef.current.get(record.id) ?? record

    setSelectedPicture(cachedOrCurrentRecord)
    setSelectedPictureError(null)
    setDetailReviewMessage(cachedOrCurrentRecord.reviewMessage ?? "")
    setActionNotice(null)

    try {
      const cachedDetail = detailCacheRef.current.get(record.id)

      if (cachedDetail) {
        return
      }

      const detail = await getAdminPictureDetail(record.id)
      const mergedDetail = mergeAdminPictureRecord(cachedOrCurrentRecord, detail)

      detailCacheRef.current.set(mergedDetail.id, mergedDetail)
      setSelectedPicture(mergedDetail)
      setDetailReviewMessage(mergedDetail.reviewMessage ?? "")
    } catch (error) {
      setSelectedPictureError(error instanceof Error ? error.message : "图片详情暂时无法加载。")
    }
  }, [])

  const submitReviewAction = useCallback(
    async (params: ReviewPictureParams) => {
      const updatedRecord = await reviewPicture(params)
      applyRecordUpdate(updatedRecord)

      return updatedRecord
    },
    [applyRecordUpdate],
  )

  const handleDetailReview = useCallback(async (reviewStatus: 1 | 2) => {
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

      setActionNotice(`已完成${reviewStatus === 1 ? "通过" : "拒绝"}审核。`)
    } catch (error) {
      setSelectedPictureError(error instanceof Error ? error.message : "审核操作失败。")
    } finally {
      setIsSubmittingDetailAction(false)
    }
  }, [detailReviewMessage, selectedPicture, submitReviewAction])

  const handleBatchReview = useCallback(async (reviewStatus: 1 | 2) => {
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
      setActionNotice(`批量处理完成：成功 ${successCount} 张`)
    } catch (error) {
      setActionNotice(error instanceof Error ? error.message : "批量审核失败。")
    } finally {
      setIsSubmittingBatchAction(false)
    }
  }, [selectedIds, batchReviewMessage, submitReviewAction])

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

      detailCacheRef.current.delete(deletedId)
      setRecords((current) => current.filter((record) => record.id !== deletedId))
      setSelectedIds((current) => current.filter((id) => id !== deletedId))
      setSelectedPicture(null)
      setDetailReviewMessage("")
      setActionNotice(`已删除图片 ${deletedId}。`)
    } catch (error) {
      setSelectedPictureError(error instanceof Error ? error.message : "删除图片失败。")
    } finally {
      setIsDeletingSelectedPicture(false)
    }
  }, [selectedPicture])

  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-10 pt-4 md:px-6 md:pb-16 md:pt-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="eyebrow-label">Admin Console</p>
          <h2 className="text-[2rem] font-medium tracking-[-0.05em] text-foreground">审核管理</h2>
          <p className="text-sm text-muted-foreground">
            支持状态切换、详情审核和批量处理，管理员可在这里集中完成审核工作。
          </p>
        </div>
        <div className="rounded-full border border-border/70 bg-white/82 px-4 py-2 text-sm text-muted-foreground">
          {summaryText}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const isActive = filter.value === filters.reviewStatus

          return (
            <button
              key={filter.label}
              type="button"
              onClick={() => handleStatusFilterChange(filter.value)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-foreground text-background"
                  : "border border-border/70 bg-white text-foreground/74 hover:text-foreground",
              )}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      {selectedCount > 0 ? (
        <div className="mb-4 rounded-[1.5rem] border border-border/70 bg-white/92 px-4 py-4 shadow-[0_20px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-foreground">已选择 {selectedCount} 张图片</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void handleBatchReview(1)}
                disabled={isSubmittingBatchAction}
              >
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
            <div className="mt-4 space-y-3 rounded-[1.25rem] border border-border/70 bg-secondary/26 p-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">批量审核意见</span>
                <textarea
                  value={batchReviewMessage}
                  onChange={(event) => setBatchReviewMessage(event.target.value)}
                  className="min-h-24 w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  onClick={() => void handleBatchReview(2)}
                  disabled={isSubmittingBatchAction}
                >
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

      {actionNotice ? (
        <div className="mb-4 rounded-[1.5rem] border border-emerald-500/16 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-950/88">
          {actionNotice}
        </div>
      ) : null}

      {pageState === "loading" ? (
        <div className="rounded-[1.5rem] border border-border/70 bg-card/70 px-6 py-16 text-center text-sm text-muted-foreground">
          正在加载审核列表...
        </div>
      ) : null}

      {pageState === "error" ? (
        <div className="rounded-[1.5rem] border border-destructive/16 bg-destructive/6 px-6 py-6 text-sm text-destructive">
          {errorMessage ?? "审核列表暂时无法加载。"}
        </div>
      ) : null}

      {pageState === "ready" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_380px]">
          <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-white/92 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
            <table className="min-w-full divide-y divide-border/70 text-left text-sm">
              <thead className="bg-secondary/36 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">选择</th>
                  <th className="px-4 py-3 font-medium">图片</th>
                  <th className="px-4 py-3 font-medium">分类</th>
                  <th className="px-4 py-3 font-medium">上传者</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">更新时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visibleRecords.map((record) => (
                  <AdminPictureRow
                    key={record.id}
                    record={record}
                    isSelected={selectedIdSet.has(record.id)}
                    onOpenDetail={handleOpenDetail}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </tbody>
            </table>
            {pageCount > 1 ? (
              <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-sm text-muted-foreground">
                <p>
                  第 {currentPageNum} / {pageCount} 页
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPageNum - 1)}
                    disabled={currentPageNum <= 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(currentPageNum + 1)}
                    disabled={currentPageNum >= pageCount}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="rounded-[1.75rem] border border-border/70 bg-white/92 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
            {selectedPicture ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="eyebrow-label">Detail</p>
                  <h3 className="text-2xl font-medium tracking-[-0.04em] text-foreground">图片详情</h3>
                  <p className="text-sm text-muted-foreground">
                    可以对当前图片执行通过、拒绝和后续管理操作。
                  </p>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] bg-secondary/40">
                  <img
                    src={selectedPicture.url}
                    alt={selectedPicture.name ?? `picture-${selectedPicture.id}`}
                    width={selectedPicture.picWidth}
                    height={selectedPicture.picHeight ?? ADMIN_DETAIL_PREVIEW_HEIGHT}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    draggable="false"
                    className="max-h-64 w-full object-cover"
                  />
                </div>

                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="text-xs tracking-[0.16em] text-muted-foreground">图片名</dt>
                    <dd className="mt-1 text-base text-foreground">{selectedPicture.name ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-[0.16em] text-muted-foreground">分类</dt>
                    <dd className="mt-1 text-base text-foreground">{selectedPicture.category ?? "未分类"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-[0.16em] text-muted-foreground">上传者</dt>
                    <dd className="mt-1">
                      <UploaderSummary record={selectedPicture} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-[0.16em] text-muted-foreground">当前状态</dt>
                    <dd className="mt-1 text-base text-foreground">
                      {getReviewStatusLabel(selectedPicture.reviewStatus)}
                    </dd>
                  </div>
                </dl>

                {selectedPictureError ? (
                  <div className="rounded-[1.25rem] border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {selectedPictureError}
                  </div>
                ) : null}

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">审核意见</span>
                  <textarea
                    value={detailReviewMessage}
                    onChange={(event) => setDetailReviewMessage(event.target.value)}
                    className="min-h-24 w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm outline-none transition focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void handleDetailReview(1)}
                    disabled={isSubmittingDetailAction}
                  >
                    通过审核
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDetailReview(2)}
                    disabled={isSubmittingDetailAction}
                  >
                    拒绝审核
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDeleteSelectedPicture()}
                    disabled={isDeletingSelectedPicture}
                  >
                    删除图片
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-[1.5rem] border border-dashed border-border/80 bg-secondary/22 px-6 text-center text-sm text-muted-foreground">
                从列表中选择一张图片，即可查看详情并执行审核操作。
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  )
}
