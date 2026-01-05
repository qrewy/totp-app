import { useI18n } from "../lib/i18n"

type Props = {
  isOpen: boolean
  isVisible: boolean
  name: string
  onClose: () => void
  onConfirm: () => void
}

export function DeleteTotpModal({ isOpen, isVisible, name, onClose, onConfirm }: Props) {
  const { t } = useI18n()

  if (!isOpen) {
    return null
  }

  return (
    <div
      className={`modal-backdrop ${isVisible ? "is-open" : "is-closing"}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("modal.delete.title")}
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("modal.delete.title")}</div>
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
          <div className="modal-label">{t("modal.delete.confirm", { name })}</div>
          <div className="modal-actions">
            <button className="modal-submit" type="button" onClick={onClose}>
              {t("actions.cancel")}
            </button>
            <button className="modal-submit is-danger" type="button" onClick={onConfirm}>
              {t("actions.delete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
