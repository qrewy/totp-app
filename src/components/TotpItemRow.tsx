import { useEffect, useRef, useState } from "react"
import type { TotpItem } from "../types"
import "../styles/totp-item.css"

type Props = {
  item: TotpItem
  code: string
  remaining: number
  warning: boolean
  critical: boolean
  highlightQuery: string
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
  highlightQuery,
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
  const [isNew, setIsNew] = useState(true)

  useEffect(() => {
    if (isDragging && isActiveDrag) {
      didDragRef.current = true
    }
  }, [isActiveDrag, isDragging])

  useEffect(() => {
    setIsNew(true)
    const timer = setTimeout(() => setIsNew(false), 800)
    return () => clearTimeout(timer)
  }, [item.id])

  const highlightText = (text: string) => {
    if (!highlightQuery) {
      return text
    }
    const lower = text.toLowerCase()
    const index = lower.indexOf(highlightQuery)
    if (index === -1) {
      return text
    }
    const before = text.slice(0, index)
    const match = text.slice(index, index + highlightQuery.length)
    const after = text.slice(index + highlightQuery.length)
    return (
      <>
        {before}
        <span className="totp-highlight">{match}</span>
        {after}
      </>
    )
  }

  return (
    <div
      className={`totp-item ${isNew ? "is-new" : ""} ${isActiveDrag ? "is-dragging" : ""} ${isDropTarget ? "is-drop-target" : ""} ${isPlaceholder ? "is-placeholder" : ""}`}
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
          <div className="totp-name">{highlightText(item.name)}</div>
          {item.issuer && <div className="totp-issuer">{highlightText(item.issuer)}</div>}
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
