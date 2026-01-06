import { useEffect, useRef } from "react"
import type { TotpItem } from "../types"
import "../styles/totp-item.css"

type Props = {
  item: TotpItem
  code: string
  remaining: number
  warning: boolean
  critical: boolean
  onCopy: (code: string) => void
  onContextMenu: (event: React.MouseEvent, item: TotpItem) => void
  dragId: string | null
  dragOverId: string | null
  isDragging: boolean
  onPointerDown: (event: React.PointerEvent, id: string) => void
  shiftY: number
  isPlaceholder: boolean
}

export function TotpItemRow({
  item,
  code,
  remaining,
  warning,
  critical,
  onCopy,
  onContextMenu,
  dragId,
  dragOverId,
  isDragging,
  onPointerDown,
  shiftY,
  isPlaceholder,
}: Props) {
  const didDragRef = useRef(false)
  const isActiveDrag = dragId === item.id
  const isDropTarget = dragOverId === item.id && dragId !== item.id

  useEffect(() => {
    if (isDragging && isActiveDrag) {
      didDragRef.current = true
    }
  }, [isActiveDrag, isDragging])

  return (
    <div
      className={`totp-item ${isActiveDrag ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""} ${isPlaceholder ? "is-placeholder" : ""}`}
      data-totp-id={item.id}
      style={shiftY ? { transform: `translateY(${shiftY}px)` } : undefined}
      onClick={() => {
        if (didDragRef.current || (isDragging && isActiveDrag)) {
          didDragRef.current = false
          return
        }
        onCopy(code)
      }}
      onContextMenu={(event) => onContextMenu(event, item)}
      onPointerDown={(event) => {
        didDragRef.current = false
        onPointerDown(event, item.id)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          void onCopy(code)
        }
      }}
    >
      <div className="totp-meta">
        <div className="totp-title-row">
          <div className="totp-name">{item.name}</div>
          {item.issuer && <div className="totp-issuer">{item.issuer}</div>}
        </div>
        <div
          className={`totp-expire ${critical ? "is-critical" : ""} ${warning ? "is-warning" : ""}`}
        >
          {remaining}s
        </div>
      </div>

      <div className="totp-code">{code}</div>
    </div>
  )
}
