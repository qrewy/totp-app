import { useI18n } from "../lib/i18n"

type Props = {
  isOpen: boolean
  isVisible: boolean
  onClose: () => void
  periodSeconds: number
}

export function SettingsModal({ isOpen, isVisible, onClose }: Props) {
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
        </div>
      </div>
    </div>
  )
}
