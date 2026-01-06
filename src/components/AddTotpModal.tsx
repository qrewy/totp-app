import type { FormEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { convertFileSrc } from "@tauri-apps/api/core"
import { getCurrentWebview } from "@tauri-apps/api/webview"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useI18n } from "../lib/i18n"
import { base32ToBytes, normalizeBase32 } from "../lib/totp"
import { parseOtpAuthPayload, type OtpScanResult } from "../lib/otpauth"
import jsQR from "jsqr"

type Props = {
  isOpen: boolean
  isVisible: boolean
  name: string
  secret: string
  onNameChange: (value: string) => void
  onSecretChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  onScanResult: (payload: OtpScanResult) => void
}

export function AddTotpModal({
  isOpen,
  isVisible,
  name,
  secret,
  onNameChange,
  onSecretChange,
  onClose,
  onSubmit,
  onScanResult,
}: Props) {
  const { t } = useI18n()
  const [isScanOpen, setIsScanOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [scanError, setScanError] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const scanHint = useMemo(
    () => [t("scan.drop"), t("scan.paste")].join(" "),
    [t],
  )

  const handleScanSuccess = useCallback(
    (payload: OtpScanResult) => {
      onScanResult(payload)
      setScanError("")
      setIsScanOpen(false)
    },
    [onScanResult],
  )

  const decodeQrFromUrl = useCallback(
    async (url: string, revokeUrl?: () => void) => {
      setIsProcessing(true)
      setScanError("")
      try {
        const image = new Image()
        const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
          image.onload = () => resolve(image)
          image.onerror = () => reject(new Error("Image load failed"))
        })
        image.src = url
        const loaded = await loadPromise
        if (revokeUrl) {
          revokeUrl()
        }
        const canvas = document.createElement("canvas")
        canvas.width = loaded.width
        canvas.height = loaded.height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          setScanError(t("scan.invalid"))
          return
        }
        ctx.drawImage(loaded, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(imageData.data, imageData.width, imageData.height)
        if (!result) {
          setScanError(t("scan.no_qr"))
          return
        }
        const raw = result.data.trim()
        const parsed = parseOtpAuthPayload(raw)
        if (parsed) {
          if (parsed.type === "single") {
            const normalized = normalizeBase32(parsed.entry.secret)
            if (!base32ToBytes(normalized)) {
              setScanError(t("scan.invalid"))
              return
            }
          }
          handleScanSuccess(parsed)
          return
        }
        const normalized = normalizeBase32(raw)
        if (!base32ToBytes(normalized)) {
          setScanError(t("scan.invalid"))
          return
        }
        handleScanSuccess({
          type: "single",
          entry: {
            name: name.trim() || t("modal.add.title"),
            secret: normalized,
          },
        })
      } catch {
        setScanError(t("scan.invalid"))
      } finally {
        setIsProcessing(false)
      }
    },
    [handleScanSuccess, name, t],
  )

  const decodeQrFromBlob = useCallback(
    async (blob: Blob) => {
      if (!blob.type.startsWith("image/")) {
        setScanError(t("scan.invalid"))
        return
      }
      const url = URL.createObjectURL(blob)
      await decodeQrFromUrl(url, () => URL.revokeObjectURL(url))
    },
    [decodeQrFromUrl, t],
  )

  useEffect(() => {
    if (!isScanOpen) {
      return
    }
    const preventDefault = (event: DragEvent) => {
      event.preventDefault()
    }
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) {
        return
      }
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            void decodeQrFromBlob(file)
          }
          return
        }
      }
    }
    window.addEventListener("dragover", preventDefault)
    window.addEventListener("drop", preventDefault)
    window.addEventListener("paste", handlePaste)
    let unlistenWindow: (() => void) | null = null
    let unlistenWebview: (() => void) | null = null
    const handleDropEvent = (payload: { type: string; paths?: string[] }) => {
        if (payload.type === "enter" || payload.type === "over") {
          setIsDragOver(true)
          return
        }
        if (payload.type === "leave") {
          setIsDragOver(false)
          return
        }
        if (payload.type === "drop") {
          setIsDragOver(false)
          const path = payload.paths?.[0]
          if (path) {
            const url = convertFileSrc(path)
            fetch(url)
              .then((response) => {
                if (!response.ok) {
                  throw new Error("Failed to load image")
                }
                return response.blob()
              })
              .then((blob) => decodeQrFromBlob(blob))
              .catch(() => {
                setScanError(t("scan.invalid"))
              })
          } else {
            setScanError(t("scan.invalid"))
          }
        }
      }
    getCurrentWindow()
      .onDragDropEvent((event) => {
        handleDropEvent(event.payload)
      })
      .then((fn) => {
        unlistenWindow = fn
      })
      .catch(() => null)
    getCurrentWebview()
      .onDragDropEvent((event) => {
        handleDropEvent(event.payload)
      })
      .then((fn) => {
        unlistenWebview = fn
      })
      .catch(() => null)
    return () => {
      window.removeEventListener("dragover", preventDefault)
      window.removeEventListener("drop", preventDefault)
      window.removeEventListener("paste", handlePaste)
      if (unlistenWindow) {
        unlistenWindow()
      }
      if (unlistenWebview) {
        unlistenWebview()
      }
    }
  }, [decodeQrFromBlob, decodeQrFromUrl, isScanOpen, t])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={`modal-backdrop ${isVisible ? "is-open" : "is-closing"}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("modal.add.title")}
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("modal.add.title")}</div>
          <button
            className="modal-close"
            type="button"
            aria-label={t("actions.close")}
            onClick={onClose}
          >
            <span className="modal-close-icon" aria-hidden="true" />
          </button>
        </div>
        <form className="modal-form" onSubmit={onSubmit}>
          <label className="modal-field">
            <span className="modal-label">{t("modal.add.name")}</span>
            <input
              className="modal-input"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={t("modal.add.placeholder.name")}
            />
          </label>
          <label className="modal-field">
            <span className="modal-label">{t("modal.add.secret")}</span>
            <input
              className="modal-input"
              value={secret}
              onChange={(event) => onSecretChange(event.target.value)}
              placeholder={t("modal.add.placeholder.secret")}
            />
          </label>
          <div className="modal-actions is-split">
            <button className="modal-submit" type="submit">
              {t("actions.add")}
            </button>
            <button
              className="modal-submit"
              type="button"
              onClick={() => setIsScanOpen((prev) => !prev)}
            >
              {t("actions.scan_qr")}
            </button>
          </div>
          <div
            className={`scan-panel ${isScanOpen ? "is-open" : ""}`}
            aria-hidden={!isScanOpen}
          >
            <div
              className={`scan-drop ${isDragOver ? "is-dragover" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragOver(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = "copy"
                setIsDragOver(true)
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget as Node | null
                if (nextTarget && event.currentTarget.contains(nextTarget)) {
                  return
                }
                setIsDragOver(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragOver(false)
                const items = event.dataTransfer.items
                if (items && items.length > 0) {
                  const entry = Array.from(items).find((item) => item.kind === "file")
                  const file = entry?.getAsFile()
                  if (file) {
                    void decodeQrFromBlob(file)
                    return
                  }
                }
                const file = event.dataTransfer.files[0]
                if (file) {
                  void decodeQrFromBlob(file)
                } else {
                  setScanError(t("scan.invalid"))
                }
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="scan-title">{t("actions.scan_qr")}</div>
              <div className="scan-hint">{scanHint}</div>
              {isProcessing && <div className="scan-status">{t("scan.processing")}</div>}
            </div>
            <input
              ref={fileInputRef}
              className="scan-file-input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void decodeQrFromBlob(file)
                }
                event.currentTarget.value = ""
              }}
            />
            {scanError && <div className="scan-error">{scanError}</div>}
          </div>
        </form>
      </div>
    </div>
  )
}
