import { useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { uploadPictureByUrl, uploadPictureFile } from "@/lib/picture-api"
import { cn } from "@/lib/utils"
import type { UploadTaskEvent } from "@/types/island-task"
import type { Photo } from "@/types/photo"

type UploadMode = "file" | "url"

interface UploadDialogProps {
  open: boolean
  onClose: () => void
  onUploadTaskEvent?: (event: UploadTaskEvent) => void
  onUploaded: (photo: Photo) => void
}

interface TextFieldProps {
  autoFocus?: boolean
  label: string
  testId: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

const DEFAULT_ERROR_MESSAGE = "上传失败，请稍后再试。"

function normalizeTagsInput(value: string) {
  return [...new Set(value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))]
}

function trimText(value: string) {
  return value.trim()
}

export function UploadDialog({ open, onClose, onUploadTaskEvent, onUploaded }: UploadDialogProps) {
  const shouldCloseFromBackdropRef = useRef(false)
  const [mode, setMode] = useState<UploadMode>("file")
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState("")
  const [picName, setPicName] = useState("")
  const [introduction, setIntroduction] = useState("")
  const [category, setCategory] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    shouldCloseFromBackdropRef.current = event.target === event.currentTarget
  }

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    const shouldClose =
      shouldCloseFromBackdropRef.current && event.target === event.currentTarget

    shouldCloseFromBackdropRef.current = false

    if (shouldClose) {
      onClose()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    const normalizedPicName = trimText(picName)
    const normalizedIntroduction = trimText(introduction)
    const normalizedCategory = trimText(category)
    const normalizedTags = normalizeTagsInput(tagsInput)

    if (mode === "file" && !file) {
      setErrorMessage("请选择图片文件。")
      return
    }

    if (mode === "url" && !trimText(fileUrl)) {
      setErrorMessage("请输入图片地址。")
      return
    }

    setIsSubmitting(true)
    onUploadTaskEvent?.({
      type: "start",
      mode,
      label: normalizedPicName || (mode === "file" ? file?.name ?? "Untitled upload" : trimText(fileUrl)),
    })

    try {
      const uploadedPhoto =
        mode === "file"
          ? await uploadPictureFile({
              file: file!,
              picName: normalizedPicName,
              introduction: normalizedIntroduction,
              category: normalizedCategory,
              tags: normalizedTags,
              onProgress: (progress) => {
                onUploadTaskEvent?.({
                  type: "progress",
                  mode: "file",
                  progress,
                })
              },
            })
          : await uploadPictureByUrl({
              fileUrl: trimText(fileUrl),
              picName: normalizedPicName,
              introduction: normalizedIntroduction,
              category: normalizedCategory,
              tags: normalizedTags,
              onProgress: (progress) => {
                onUploadTaskEvent?.({
                  type: "progress",
                  mode: "url",
                  progress,
                })
              },
            })

      onUploadTaskEvent?.({
        type: "success",
        mode,
        photo: uploadedPhoto,
      })
      onUploaded(uploadedPhoto)
    } catch (error) {
      const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE

      setErrorMessage(message)
      onUploadTaskEvent?.({
        type: "error",
        mode,
        message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-testid="upload-backdrop"
      className="fixed inset-0 z-[75] bg-[rgba(17,17,19,0.42)] backdrop-blur-[14px]"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-screen items-center justify-center p-4 md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="上传图片"
          className="w-full max-w-[520px] rounded-[2rem] border border-black/10 bg-[#fbfaf7]/96 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.18)] backdrop-blur-xl md:p-7"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="eyebrow-label">图片上传</p>
              <h2 className="text-[1.9rem] font-medium tracking-[-0.05em] text-foreground">新增作品</h2>
              <p className="max-w-[36ch] text-sm leading-6 text-muted-foreground">
                支持本地文件上传和远程 URL 导入。普通用户上传后可能需要等待审核通过才会出现在公共图库中。
              </p>
            </div>
            <button
              type="button"
              aria-label="关闭上传弹窗"
              className="inline-flex rounded-full border border-border/70 bg-background/82 p-2 text-foreground transition hover:bg-secondary"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-7 flex rounded-full border border-border/80 bg-white/80 p-1">
            <button
              type="button"
              data-testid="upload-mode-file"
              aria-pressed={mode === "file"}
              onClick={() => {
                setMode("file")
                setErrorMessage(null)
              }}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm transition",
                mode === "file" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              本地文件
            </button>
            <button
              type="button"
              data-testid="upload-mode-url"
              aria-pressed={mode === "url"}
              onClick={() => {
                setMode("url")
                setErrorMessage(null)
              }}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm transition",
                mode === "url" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              远程地址
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {mode === "file" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-foreground">图片文件</span>
                <input
                  data-testid="upload-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null)
                    setErrorMessage(null)
                  }}
                  className="block w-full rounded-2xl border border-border/80 bg-white px-4 py-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-background"
                />
                {file ? <p className="text-sm text-muted-foreground">{file.name}</p> : null}
              </label>
            ) : (
              <TextField
                autoFocus
                label="图片地址"
                testId="upload-url-input"
                value={fileUrl}
                placeholder="https://example.com/demo.webp"
                onChange={(value) => {
                  setFileUrl(value)
                  setErrorMessage(null)
                }}
              />
            )}

            <TextField
              label="图片名称"
              testId="upload-name-input"
              value={picName}
              onChange={setPicName}
              placeholder="可选"
            />
            <TextField
              label="简介"
              testId="upload-introduction-input"
              value={introduction}
              onChange={setIntroduction}
              placeholder="可选"
            />
            <TextField
              label="分类"
              testId="upload-category-input"
              value={category}
              onChange={setCategory}
              placeholder="例如 travel"
            />
            <TextField
              label="标签"
              testId="upload-tags-input"
              value={tagsInput}
              onChange={setTagsInput}
              placeholder="使用逗号分隔，例如 sea, sunset"
            />

            {errorMessage ? (
              <div className="rounded-[1.4rem] border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <Button
              type="submit"
              data-testid="upload-submit"
              className="mt-2 h-11 w-full rounded-2xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? "上传中..." : "开始上传"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

function TextField({ autoFocus, label, testId, value, onChange, placeholder }: TextFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        data-testid={testId}
        autoFocus={autoFocus}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-border/80 bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-muted-foreground/80 focus:border-foreground/28 focus:ring-2 focus:ring-ring/20"
      />
    </label>
  )
}
