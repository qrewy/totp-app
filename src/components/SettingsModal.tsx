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
}: Props) {
  const { locale, setLocale, t } = useI18n()

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
            <div className="modal-toggle-group">
              <button
                type="button"
                className={`modal-toggle ${locale === "en" ? "is-active" : ""}`}
                onClick={() => setLocale("en")}
              >
                {t("settings.language.en")}
              </button>
              <button
                type="button"
                className={`modal-toggle ${locale === "ru" ? "is-active" : ""}`}
                onClick={() => setLocale("ru")}
              >
                {t("settings.language.ru")}
              </button>
            </div>
          </div>
          <div className="modal-row">
            <div className="modal-label">{t("settings.export")}</div>
            <button className="modal-submit is-secondary" type="button" onClick={onExportAll}>
              {t("export.title")}
            </button>
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
          <div className="modal-row">
            <div className="modal-label">{t("settings.pin")}</div>
            <div className="modal-button-group">
              <button className="modal-submit is-secondary" type="button" onClick={onSetPin}>
                {hasPin ? t("actions.change_pin") : t("actions.set_pin")}
              </button>
              {hasPin && (
                <button className="modal-submit is-secondary" type="button" onClick={onRemovePin}>
                  {t("actions.remove_pin")}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer-note">created with &lt;3 by qrewy</div>
      </div>
    </div>
  )
}
