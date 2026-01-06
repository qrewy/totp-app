import { useI18n } from "../lib/i18n"
import "../styles/topbar.css"

type Props = {
  onSettings: () => void
  onLock: () => void
  showLock: boolean
  settingsDisabled: boolean
  onMinimize: () => void
  onClose: () => void
}

export function Topbar({
  onSettings,
  onLock,
  showLock,
  settingsDisabled,
  onMinimize,
  onClose,
}: Props) {
  const { t } = useI18n()

  return (
    <header className="topbar">
      <button
        className="topbar-title-button"
        type="button"
        aria-label={t("actions.settings")}
        onClick={onSettings}
        disabled={settingsDisabled}
      >
        {t("app.title")}
      </button>
      <div className="topbar-actions">
        {showLock && (
          <button
            className="topbar-button"
            type="button"
            aria-label={t("actions.lock")}
            onClick={onLock}
          >
            <span className="topbar-icon lock" aria-hidden="true" />
          </button>
        )}
        <button
          className="topbar-button"
          type="button"
          aria-label={t("actions.minimize")}
          onClick={onMinimize}
        >
          <span className="topbar-icon minimize" aria-hidden="true" />
        </button>
        <button
          className="topbar-button close"
          type="button"
          aria-label={t("actions.close")}
          onClick={onClose}
        >
          <span className="topbar-icon close" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
