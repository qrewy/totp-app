import { useEffect, useRef, useState } from "react"
import type { TotpItem } from "../types"
import { useI18n } from "../lib/i18n"

type QrEntry = {
  id: string
  title: string
  dataUrl: string
}

type Props = {
  isOpen: boolean
  isVisible: boolean
  items: TotpItem[]
  selectedIds: string[]
  qrEntries: QrEntry[]
  onToggle: (id: string) => void
  onToggleAll: () => void
  onDownload: () => void
  onDownloadQrs: () => void
  onClose: () => void
}

export function ExportQrModal({
  isOpen,
  isVisible,
  items,
  selectedIds,
  qrEntries,
  onToggle,
  onToggleAll,
  onDownload,
  onDownloadQrs,
  onClose,
}: Props) {
  const { t } = useI18n()
  const [activeQr, setActiveQr] = useState<{ title: string; dataUrl: string } | null>(
    null,
  )
  const [isQrVisible, setIsQrVisible] = useState(false)
  const qrCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qrOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openQr = (entry: { title: string; dataUrl: string }) => {
    setActiveQr(entry)
    setIsQrVisible(false)
    if (qrCloseTimerRef.current) {
      clearTimeout(qrCloseTimerRef.current)
      qrCloseTimerRef.current = null
    }
    if (qrOpenTimerRef.current) {
      clearTimeout(qrOpenTimerRef.current)
    }
    qrOpenTimerRef.current = setTimeout(() => {
      setIsQrVisible(true)
      qrOpenTimerRef.current = null
    }, 10)
  }

  const closeQr = () => {
    if (!activeQr) {
      return
    }
    setIsQrVisible(false)
    if (qrOpenTimerRef.current) {
      clearTimeout(qrOpenTimerRef.current)
      qrOpenTimerRef.current = null
    }
    if (qrCloseTimerRef.current) {
      clearTimeout(qrCloseTimerRef.current)
    }
    qrCloseTimerRef.current = setTimeout(() => {
      setActiveQr(null)
      qrCloseTimerRef.current = null
    }, 180)
  }

  useEffect(() => {
    return () => {
      if (qrCloseTimerRef.current) {
        clearTimeout(qrCloseTimerRef.current)
      }
      if (qrOpenTimerRef.current) {
        clearTimeout(qrOpenTimerRef.current)
      }
    }
  }, [])

  if (!isOpen) {
    return null
  }

  const selectionLabel = selectedIds.length
    ? t("export.selected", { count: String(selectedIds.length) })
    : t("export.none")
  const isAllSelected = items.length > 0 && selectedIds.length === items.length

  return (
    <div
      className={`modal-backdrop ${isVisible ? "is-open" : "is-closing"}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("export.title")}
      onClick={onClose}
    >
      <div
        className="modal export-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title">{t("export.title")}</div>
          <button
            className="modal-close"
            type="button"
            aria-label={t("actions.close")}
            onClick={onClose}
          >
            <span className="modal-close-icon" aria-hidden="true" />
          </button>
        </div>
        <div className="export-body">
          <div className="export-selection-row">
            <div className="export-selection">{selectionLabel}</div>
            <button
              className="export-toggle"
              type="button"
              onClick={onToggleAll}
              disabled={items.length === 0}
            >
              {isAllSelected ? t("export.deselect_all") : t("export.select_all")}
            </button>
          </div>
          <div className="export-list">
            {items.map((item) => {
              const checked = selectedIds.includes(item.id)
              return (
                <label key={item.id} className="export-item">
                  <input
                    type="checkbox"
                    className="export-checkbox-input"
                    checked={checked}
                    onChange={() => onToggle(item.id)}
                  />
                  <span className="export-checkbox" aria-hidden="true" />
                  <span className="export-item-name">{item.name}</span>
                  {item.issuer && (
                    <span className="export-item-issuer">{item.issuer}</span>
                  )}
                </label>
              )
            })}
          </div>
          {qrEntries.length > 0 && (
            <div className="export-qr-grid">
              {qrEntries.map((entry) => (
                <div key={entry.id} className="export-qr-card">
                  <img
                    className="export-qr-image"
                    src={entry.dataUrl}
                    alt={entry.title}
                    onClick={() => openQr({ title: entry.title, dataUrl: entry.dataUrl })}
                  />
                  <div className="export-qr-title">
                    {entry.title}
                  </div>
                </div>
              ))}
            </div>
          )}
          {qrEntries.length === 0 && (
            <div className="export-empty">{t("export.empty_qr")}</div>
          )}
        </div>
        <div className="export-actions">
          <button
            className="modal-submit is-secondary"
            type="button"
            onClick={onDownload}
            disabled={!selectedIds.length}
          >
            {t("actions.export_selected")}
          </button>
          <button
            className="modal-submit is-secondary"
            type="button"
            onClick={onDownloadQrs}
            disabled={!qrEntries.length}
          >
            {t("actions.download_qr")}
          </button>
        </div>
      </div>
      {activeQr && (
        <div
          className={`qr-lightbox ${isQrVisible ? "is-open" : "is-closing"}`}
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation()
            closeQr()
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              event.stopPropagation()
              closeQr()
            }
          }}
        >
          <div
            className={`qr-lightbox-card ${isQrVisible ? "is-open" : "is-closing"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <img
              className="qr-lightbox-image"
              src={activeQr.dataUrl}
              alt={activeQr.title}
            />
            <div className="qr-lightbox-title">{activeQr.title}</div>
          </div>
        </div>
      )}
    </div>
  )
}
