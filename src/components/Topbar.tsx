import { useI18n } from "../lib/i18n"
import "../styles/topbar.css"

type Props = {
  onSettings: () => void
  onMinimize: () => void
  onClose: () => void
}

export function Topbar({ onSettings, onMinimize, onClose }: Props) {
  const { t } = useI18n()

  return (
    <header className="topbar">
      <button
        className="topbar-title-button"
        type="button"
        aria-label={t("actions.settings")}
        onClick={onSettings}
      >
        {t("app.title")}
      </button>
      <div className="topbar-actions">
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
