import { useEffect, useRef, useState } from "react"
import { useI18n } from "../lib/i18n"

type Props = {
  isOpen: boolean
  isVisible: boolean
  onClose: () => void
  periodSeconds: number
  onExportAll: () => void
  hasPin: boolean
  onSetPin: () => void
  onRemovePin: () => void
  blurCodes: boolean
  onToggleBlur: () => void
  closeToTray: boolean
  onToggleCloseToTray: () => void
  appVersion: string
}

export function SettingsModal({
  isOpen,
  isVisible,
  onClose,
  onExportAll,
  hasPin,
  onSetPin,
  onRemovePin,
  blurCodes,
  onToggleBlur,
  closeToTray,
  onToggleCloseToTray,
  appVersion,
}: Props) {
  const { locale, setLocale, t } = useI18n()
  const [isLangOpen, setIsLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement | null>(null)
  const languageOptions = [
    { value: "en" as const, label: t("settings.language.en") },
    { value: "ru" as const, label: t("settings.language.ru") },
  ]
  const selectedLanguage =
    languageOptions.find((option) => option.value === locale) ?? languageOptions[0]

  useEffect(() => {
    if (!isLangOpen) {
      return
    }
    const handleClick = (event: MouseEvent) => {
      if (!langRef.current) {
        return
      }
      if (!langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLangOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [isLangOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={`modal-backdrop ${isVisible ? "is-open" : "is-closing"}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("settings.title")}</div>
          <button
            className="modal-close"
            type="button"
            aria-label={t("actions.close")}
            onClick={onClose}
          >
            <span className="modal-close-icon" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-row">
            <div className="modal-label">{t("settings.language")}</div>
            <div className="modal-dropdown" ref={langRef}>
              <button
                type="button"
                className={`modal-dropdown-trigger ${isLangOpen ? "is-open" : ""}`}
                onClick={() => setIsLangOpen((value) => !value)}
                aria-haspopup="listbox"
                aria-expanded={isLangOpen}
              >
                <span className="modal-dropdown-value">{selectedLanguage.label}</span>
                <span className="modal-dropdown-chevron" aria-hidden="true" />
              </button>
              <div
                className={`modal-dropdown-menu ${isLangOpen ? "is-open" : ""}`}
                role="listbox"
                aria-hidden={!isLangOpen}
              >
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`modal-dropdown-item ${
                      locale === option.value ? "is-active" : ""
                    }`}
                    role="option"
                    aria-selected={locale === option.value}
                    onClick={() => {
                      setLocale(option.value)
                      setIsLangOpen(false)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-row">
            <div className="modal-label">{t("settings.blur_codes")}</div>
            <button
              className={`modal-toggle-switch ${blurCodes ? "is-on" : ""}`}
              type="button"
              role="switch"
              aria-checked={blurCodes}
              aria-label={t("settings.blur_codes")}
              onClick={onToggleBlur}
            />
          </div>
          <div className="modal-row">
            <div className="modal-label">{t("settings.close_to_tray")}</div>
            <button
              className={`modal-toggle-switch ${closeToTray ? "is-on" : ""}`}
              type="button"
              role="switch"
              aria-checked={closeToTray}
              aria-label={t("settings.close_to_tray")}
              onClick={onToggleCloseToTray}
            />
          </div>
          <button
            className="modal-row modal-row-button is-center"
            type="button"
            onClick={onExportAll}
          >
            <span className="modal-row-action is-normal">{t("settings.export")}</span>
          </button>
          {hasPin ? (
            <div className="modal-row-actions">
              <button
                className="modal-submit is-secondary modal-pin-button"
                type="button"
                onClick={onSetPin}
              >
                {t("settings.change_pin")}
              </button>
              <button
                className="modal-submit is-secondary is-danger-outline modal-pin-button"
                type="button"
                onClick={onRemovePin}
              >
                {t("actions.remove_pin")}
              </button>
            </div>
          ) : (
            <button
              className="modal-submit is-secondary modal-pin-button"
              type="button"
              onClick={onSetPin}
            >
              {t("actions.set_pin")}
            </button>
          )}
        </div>
        <div className="modal-footer-note">created with &lt;3 by qrewy</div>
        {appVersion && <div className="modal-footer-version">v{appVersion}</div>}
      </div>
    </div>
  )
}
