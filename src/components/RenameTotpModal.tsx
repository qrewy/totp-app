import type { FormEvent } from "react"
import { useI18n } from "../lib/i18n"

type Props = {
  isOpen: boolean
  isVisible: boolean
  name: string
  onNameChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}

export function RenameTotpModal({
  isOpen,
  isVisible,
  name,
  onNameChange,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useI18n()

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={`modal-backdrop ${isVisible ? "is-open" : "is-closing"}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("modal.rename.title")}
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("modal.rename.title")}</div>
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
              placeholder={t("modal.rename.placeholder.name")}
              autoFocus
            />
          </label>
          <div className="modal-actions">
            <button className="modal-submit" type="submit">
              {t("actions.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
