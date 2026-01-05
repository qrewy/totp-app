import { useLayoutEffect, useMemo, useState } from "react"
import { useI18n } from "../lib/i18n"
import type { TotpItem } from "../types"
import { TotpItemRow } from "./TotpItemRow"
import "../styles/totp-list.css"

type Props = {
  items: TotpItem[]
  codes: Record<string, string>
  nowSec: number
  defaultPeriod: number
  onCopy: (code: string) => void
  onContextMenu: (event: React.MouseEvent, item: TotpItem) => void
  dragId: string | null
  dragOverId: string | null
  isDragging: boolean
  onPointerDown: (event: React.PointerEvent, id: string) => void
  listRef: React.RefObject<HTMLDivElement | null>
}

export function TotpList({
  items,
  codes,
  nowSec,
  defaultPeriod,
  onCopy,
  onContextMenu,
  dragId,
  dragOverId,
  isDragging,
  onPointerDown,
  listRef,
}: Props) {
  const { t } = useI18n()
  const [itemSpacing, setItemSpacing] = useState(0)

  useLayoutEffect(() => {
    const listEl = listRef.current
    if (!listEl) {
      return
    }
    const firstItem = listEl.querySelector<HTMLElement>(".totp-item")
    if (!firstItem) {
      return
    }
    const listStyles = getComputedStyle(listEl)
    const gap = Number.parseFloat(listStyles.rowGap || "0") || 0
    const rect = firstItem.getBoundingClientRect()
    const nextSpacing = Math.round(rect.height + gap)
    setItemSpacing((prev) => (prev !== nextSpacing ? nextSpacing : prev))
  }, [items.length])

  const dragIndices = useMemo(() => {
    if (!dragId || !dragOverId) {
      return null
    }
    const fromIndex = items.findIndex((item) => item.id === dragId)
    const toIndex = items.findIndex((item) => item.id === dragOverId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return null
    }
    return { fromIndex, toIndex }
  }, [dragId, dragOverId, items])

  if (items.length === 0) {
    return <div className="empty-state">{t("empty.title")}</div>
  }

  return (
    <div className="totp-list" ref={listRef}>
      {items.map((item, index) => {
        const period = item.period ?? defaultPeriod
        const remaining = Math.max(0, Math.ceil(period - (nowSec % period)))
        const warning = remaining <= 10
        const critical = remaining <= 5
        const code = codes[item.id] ?? item.code ?? "------"
        const isActiveDrag = dragId === item.id
        let shiftY = 0

        if (dragIndices && itemSpacing && !isActiveDrag) {
          const { fromIndex, toIndex } = dragIndices
          if (fromIndex < toIndex && index > fromIndex && index <= toIndex) {
            shiftY = -itemSpacing
          } else if (fromIndex > toIndex && index >= toIndex && index < fromIndex) {
            shiftY = itemSpacing
          }
        }

        return (
          <TotpItemRow
            key={item.id}
            item={item}
            code={code}
            remaining={remaining}
            warning={warning}
            critical={critical}
            onCopy={onCopy}
            onContextMenu={onContextMenu}
            dragId={dragId}
            dragOverId={dragOverId}
            isDragging={isDragging}
            onPointerDown={onPointerDown}
            shiftY={shiftY}
            isPlaceholder={isActiveDrag && isDragging}
          />
        )
      })}
    </div>
  )
}
