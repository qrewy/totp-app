import type { FormEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { AddButton } from "./components/AddButton"
import { AddTotpModal } from "./components/AddTotpModal"
import { ContextMenu } from "./components/ContextMenu"
import { DeleteTotpModal } from "./components/DeleteTotpModal"
import { RenameTotpModal } from "./components/RenameTotpModal"
import { SettingsModal } from "./components/SettingsModal"
import { Toast } from "./components/Toast"
import { Topbar } from "./components/Topbar"
import { TotpList } from "./components/TotpList"
import { useNowRaf } from "./hooks/useNowRaf"
import { useI18n } from "./lib/i18n"
import { loadItems, saveItems } from "./lib/itemsStorage"
import { base32ToBytes, generateTotp, normalizeBase32 } from "./lib/totp"
import type { TotpItem } from "./types"
import "./index.css"
import "./styles/context-menu.css"
import "./styles/drag.css"
import "./styles/modal.css"

const PERIOD_SECONDS = 30

export default function App() {
  const appWindow = getCurrentWindow()
  const nowMs = useNowRaf()
  const { t } = useI18n()
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modalCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modalOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renameCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renameOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deleteOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [toast, setToast] = useState("")
  const [items, setItems] = useState<TotpItem[]>([])
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSettingsVisible, setIsSettingsVisible] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isAddVisible, setIsAddVisible] = useState(false)
  const [addName, setAddName] = useState("")
  const [addSecret, setAddSecret] = useState("")
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [isRenameVisible, setIsRenameVisible] = useState(false)
  const [renameName, setRenameName] = useState("")
  const [renameId, setRenameId] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleteVisible, setIsDeleteVisible] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number; dropping: boolean } | null>(
    null,
  )
  const listRef = useRef<HTMLDivElement | null>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)
  const dragLayoutRef = useRef<
    { id: string; midY: number; top: number; bottom: number; listTop: number; listBottom: number }[]
  >([])
  const dragRafRef = useRef<number | null>(null)
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null)
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    itemId: null as string | null,
  })

  const nowSec = useMemo(() => nowMs / 1000, [nowMs])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const stored = await loadItems()
      if (mounted) {
        setItems(stored)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }
    window.addEventListener("contextmenu", handleContextMenu)
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [])

  useEffect(() => {
    document.body.classList.toggle("is-dragging", isDragging)
  }, [isDragging])

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null

    const updateCodes = async () => {
      const now = Date.now()
      const entries: Array<[string, string]> = []
      for (const item of items) {
        const period = item.period ?? PERIOD_SECONDS
        const digits = item.digits ?? 6
        if (item.secret) {
          const value = await generateTotp(item.secret, period, digits, now)
          entries.push([item.id, value ?? "------"])
        } else if (item.code) {
          entries.push([item.id, item.code])
        } else {
          entries.push([item.id, "------"])
        }
      }
      if (active) {
        setCodes(Object.fromEntries(entries))
      }
    }

    void updateCodes()
    timer = setInterval(updateCodes, 1000)

    return () => {
      active = false
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [items])

  const handleMinimize = () => {
    void appWindow.minimize()
  }

  const handleClose = () => {
    void appWindow.close()
  }

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true)
    setIsSettingsVisible(false)
    if (modalCloseTimerRef.current) {
      clearTimeout(modalCloseTimerRef.current)
      modalCloseTimerRef.current = null
    }
    if (modalOpenTimerRef.current) {
      clearTimeout(modalOpenTimerRef.current)
    }
    modalOpenTimerRef.current = setTimeout(() => {
      setIsSettingsVisible(true)
      modalOpenTimerRef.current = null
    }, 10)
  }, [])

  const closeSettings = useCallback(() => {
    if (!isSettingsOpen) {
      return
    }
    setIsSettingsVisible(false)
    if (modalOpenTimerRef.current) {
      clearTimeout(modalOpenTimerRef.current)
      modalOpenTimerRef.current = null
    }
    if (modalCloseTimerRef.current) {
      clearTimeout(modalCloseTimerRef.current)
    }
    modalCloseTimerRef.current = setTimeout(() => {
      setIsSettingsOpen(false)
      modalCloseTimerRef.current = null
    }, 180)
  }, [isSettingsOpen])

  const openAdd = useCallback(() => {
    setIsAddOpen(true)
    setIsAddVisible(false)
    if (addCloseTimerRef.current) {
      clearTimeout(addCloseTimerRef.current)
      addCloseTimerRef.current = null
    }
    if (addOpenTimerRef.current) {
      clearTimeout(addOpenTimerRef.current)
    }
    addOpenTimerRef.current = setTimeout(() => {
      setIsAddVisible(true)
      addOpenTimerRef.current = null
    }, 10)
  }, [])

  const closeAdd = useCallback(() => {
    if (!isAddOpen) {
      return
    }
    setIsAddVisible(false)
    if (addOpenTimerRef.current) {
      clearTimeout(addOpenTimerRef.current)
      addOpenTimerRef.current = null
    }
    if (addCloseTimerRef.current) {
      clearTimeout(addCloseTimerRef.current)
    }
    addCloseTimerRef.current = setTimeout(() => {
      setIsAddOpen(false)
      addCloseTimerRef.current = null
    }, 180)
  }, [isAddOpen])

  const openRename = useCallback((item: TotpItem) => {
    setRenameId(item.id)
    setRenameName(item.name)
    setIsRenameOpen(true)
    setIsRenameVisible(false)
    if (renameCloseTimerRef.current) {
      clearTimeout(renameCloseTimerRef.current)
      renameCloseTimerRef.current = null
    }
    if (renameOpenTimerRef.current) {
      clearTimeout(renameOpenTimerRef.current)
    }
    renameOpenTimerRef.current = setTimeout(() => {
      setIsRenameVisible(true)
      renameOpenTimerRef.current = null
    }, 10)
  }, [])

  const closeRename = useCallback(() => {
    if (!isRenameOpen) {
      return
    }
    setIsRenameVisible(false)
    if (renameOpenTimerRef.current) {
      clearTimeout(renameOpenTimerRef.current)
      renameOpenTimerRef.current = null
    }
    if (renameCloseTimerRef.current) {
      clearTimeout(renameCloseTimerRef.current)
    }
    renameCloseTimerRef.current = setTimeout(() => {
      setIsRenameOpen(false)
      setRenameId(null)
      renameCloseTimerRef.current = null
    }, 180)
  }, [isRenameOpen])

  const openDelete = useCallback((item: TotpItem) => {
    setDeleteId(item.id)
    setIsDeleteOpen(true)
    setIsDeleteVisible(false)
    if (deleteCloseTimerRef.current) {
      clearTimeout(deleteCloseTimerRef.current)
      deleteCloseTimerRef.current = null
    }
    if (deleteOpenTimerRef.current) {
      clearTimeout(deleteOpenTimerRef.current)
    }
    deleteOpenTimerRef.current = setTimeout(() => {
      setIsDeleteVisible(true)
      deleteOpenTimerRef.current = null
    }, 10)
  }, [])

  const closeDelete = useCallback(() => {
    if (!isDeleteOpen) {
      return
    }
    setIsDeleteVisible(false)
    if (deleteOpenTimerRef.current) {
      clearTimeout(deleteOpenTimerRef.current)
      deleteOpenTimerRef.current = null
    }
    if (deleteCloseTimerRef.current) {
      clearTimeout(deleteCloseTimerRef.current)
    }
    deleteCloseTimerRef.current = setTimeout(() => {
      setIsDeleteOpen(false)
      setDeleteId(null)
      deleteCloseTimerRef.current = null
    }, 180)
  }, [isDeleteOpen])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = setTimeout(() => {
      setToast("")
      toastTimerRef.current = null
    }, 1400)
  }, [])

  const handleCopy = async (code: string) => {
    try {
      const value = code.replace(/\s/g, "")
      await navigator.clipboard.writeText(value)
      showToast(t("toast.copied"))
    } catch {
      showToast(t("toast.copy_failed"))
    }
  }

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => {
      if (!prev.isOpen) {
        return prev
      }
      return { ...prev, isOpen: false, itemId: null }
    })
  }, [])

  const handleContextMenu = useCallback((event: React.MouseEvent, item: TotpItem) => {
    event.preventDefault()
    const menuWidth = 170
    const menuHeight = 92
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8)
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8)
    setContextMenu({
      isOpen: true,
      x,
      y,
      itemId: item.id,
    })
  }, [])

  const handleAddSubmit = (event: FormEvent) => {
    event.preventDefault()
    const name = addName.trim()
    const secret = addSecret.trim()
    if (!name || !secret) {
      showToast(t("toast.fill_all"))
      return
    }
    if (!base32ToBytes(secret)) {
      showToast(t("toast.invalid_secret"))
      return
    }
    const id =
      typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now())
    const nextItem: TotpItem = {
      id,
      name,
      secret: normalizeBase32(secret),
      digits: 6,
      period: PERIOD_SECONDS,
    }
    setItems((prev) => {
      const next = [...prev, nextItem]
      void saveItems(next)
      return next
    })
    setAddName("")
    setAddSecret("")
    closeAdd()
    showToast(t("toast.added"))
  }

  const handleScanResult = useCallback(
    (payload: { name: string; secret: string }) => {
      setAddName(payload.name)
      setAddSecret(payload.secret)
      showToast(t("toast.scan_loaded"))
    },
    [showToast, t],
  )

  const handleRenameSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextName = renameName.trim()
    if (!renameId) {
      return
    }
    if (!nextName) {
      showToast(t("toast.enter_name"))
      return
    }
    setItems((prev) => {
      const next = prev.map((item) =>
        item.id === renameId ? { ...item, name: nextName } : item,
      )
      void saveItems(next)
      return next
    })
    closeRename()
    showToast(t("toast.renamed"))
  }

  const handleDelete = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((item) => item.id !== id)
        void saveItems(next)
        return next
      })
      if (renameId === id) {
        closeRename()
      }
      if (deleteId === id) {
        closeDelete()
      }
      showToast(t("toast.deleted"))
    },
    [closeDelete, closeRename, deleteId, renameId, showToast, t],
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, itemId: string) => {
      if (event.button !== 0) {
        return
      }
      event.preventDefault()
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()
      closeContextMenu()
      const listEl = listRef.current
      if (listEl) {
        const listRect = listEl.getBoundingClientRect()
        const layout = items
          .map((item) => {
            const el = listEl.querySelector<HTMLElement>(`[data-totp-id="${item.id}"]`)
            if (!el) {
              return null
            }
            const itemRect = el.getBoundingClientRect()
            return {
              id: item.id,
              midY: itemRect.top + itemRect.height / 2,
              top: itemRect.top,
              bottom: itemRect.bottom,
              listTop: listRect.top,
              listBottom: listRect.bottom,
            }
          })
          .filter(
            (
              entry,
            ): entry is {
              id: string
              midY: number
              top: number
              bottom: number
              listTop: number
              listBottom: number
            } => Boolean(entry),
          )
        dragLayoutRef.current = layout
      }
      setDragId(itemId)
      setDragOverId(null)
      setIsDragging(false)
      setDragPosition({ x: event.clientX, y: event.clientY })
      dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      dragStartRef.current = { x: event.clientX, y: event.clientY }
    },
    [closeContextMenu, items],
  )

  const handleReorder = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return
    }
    setItems((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === sourceId)
      const toIndex = prev.findIndex((item) => item.id === targetId)
      if (fromIndex === -1 || toIndex === -1) {
        return prev
      }
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      void saveItems(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (!dragId) {
      return
    }

    const handleMove = (event: PointerEvent) => {
      const start = dragStartRef.current
      if (!start) {
        return
      }
      dragPointerRef.current = { x: event.clientX, y: event.clientY }
      if (dragRafRef.current) {
        return
      }
      dragRafRef.current = window.requestAnimationFrame(() => {
        dragRafRef.current = null
        const pointer = dragPointerRef.current
        if (!pointer) {
          return
        }
        const offset = dragOffsetRef.current
        const dx = pointer.x - start.x
        const dy = pointer.y - start.y
        const moved = Math.hypot(dx, dy) > 4
        if (moved && !isDragging) {
          setIsDragging(true)
        }
        if (moved) {
          const nextX = pointer.x - (offset?.x ?? 0)
          const nextY = pointer.y - (offset?.y ?? 0)
          setDragPosition({ x: nextX, y: nextY })
          setGhost({ id: dragId, x: nextX, y: nextY, dropping: false })
          const layout = dragLayoutRef.current
          if (layout.length) {
            const listTop = layout[0].listTop
            const listBottom = layout[0].listBottom
            if (pointer.y < listTop || pointer.y > listBottom) {
              setDragOverId(null)
              return
            }
            const filtered = layout.filter((entry) => entry.id !== dragId)
            if (!filtered.length) {
              setDragOverId(null)
              return
            }
            const targetEntry =
              filtered.find((entry) => pointer.y <= entry.midY) ??
              filtered[filtered.length - 1]
            setDragOverId(targetEntry.id)
          }
        }
      })
    }

    const handleEnd = () => {
      if (isDragging && dragOverId && dragOverId !== dragId) {
        handleReorder(dragId, dragOverId)
      }
      if (ghostTimerRef.current) {
        clearTimeout(ghostTimerRef.current)
      }
      setGhost((prev) => {
        if (!prev) {
          return null
        }
        ghostTimerRef.current = setTimeout(() => {
          setGhost(null)
          setDragPosition(null)
          ghostTimerRef.current = null
        }, 240)
        return { ...prev, dropping: true }
      })
      if (!ghost) {
        setDragPosition(null)
      }
      setDragId(null)
      setDragOverId(null)
      setIsDragging(false)
      dragStartRef.current = null
      dragOffsetRef.current = null
      dragPointerRef.current = null
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleEnd)
    window.addEventListener("pointercancel", handleEnd)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleEnd)
      window.removeEventListener("pointercancel", handleEnd)
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }
    }
  }, [dragId, dragOverId, handleReorder, isDragging])

  const contextMenuItems = useMemo(() => {
    const item = items.find((entry) => entry.id === contextMenu.itemId)
    if (!item) {
      return []
    }
    return [
      {
        id: "rename",
        label: t("menu.rename"),
        onClick: () => {
          closeContextMenu()
          openRename(item)
        },
      },
      {
        id: "delete",
        label: t("menu.delete"),
        danger: true,
        onClick: () => {
          closeContextMenu()
          openDelete(item)
        },
      },
    ]
  }, [closeContextMenu, contextMenu.itemId, items, openDelete, openRename, t])

  const dragPreview = useMemo(() => {
    if (dragId) {
      return items.find((item) => item.id === dragId) ?? null
    }
    if (ghost) {
      return items.find((item) => item.id === ghost.id) ?? null
    }
    return null
  }, [dragId, ghost, items])

  useEffect(() => {
    if (!contextMenu.isOpen) {
      return
    }
    const handlePointer = () => {
      closeContextMenu()
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu()
      }
    }
    window.addEventListener("mousedown", handlePointer)
    window.addEventListener("resize", handlePointer)
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("mousedown", handlePointer)
      window.removeEventListener("resize", handlePointer)
      window.removeEventListener("keydown", handleKey)
    }
  }, [closeContextMenu, contextMenu.isOpen])

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
      if (modalCloseTimerRef.current) {
        clearTimeout(modalCloseTimerRef.current)
      }
      if (modalOpenTimerRef.current) {
        clearTimeout(modalOpenTimerRef.current)
      }
      if (addCloseTimerRef.current) {
        clearTimeout(addCloseTimerRef.current)
      }
      if (addOpenTimerRef.current) {
        clearTimeout(addOpenTimerRef.current)
      }
      if (renameCloseTimerRef.current) {
        clearTimeout(renameCloseTimerRef.current)
      }
      if (renameOpenTimerRef.current) {
        clearTimeout(renameOpenTimerRef.current)
      }
      if (deleteCloseTimerRef.current) {
        clearTimeout(deleteCloseTimerRef.current)
      }
      if (deleteOpenTimerRef.current) {
        clearTimeout(deleteOpenTimerRef.current)
      }
      if (ghostTimerRef.current) {
        clearTimeout(ghostTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="app">
      <Topbar onSettings={openSettings} onMinimize={handleMinimize} onClose={handleClose} />

      <main className="content">
        <TotpList
          items={items}
          codes={codes}
          nowSec={nowSec}
          defaultPeriod={PERIOD_SECONDS}
          onCopy={handleCopy}
          onContextMenu={handleContextMenu}
          dragId={dragId}
          dragOverId={dragOverId}
          isDragging={isDragging}
          onPointerDown={handlePointerDown}
          listRef={listRef}
        />
      </main>

      <AddButton onClick={openAdd} />

      {toast && <Toast message={toast} />}

      {(isDragging || ghost) && dragPosition && dragPreview && (
        <div
          className={`drag-ghost ${ghost?.dropping ? "is-dropping" : ""}`}
          style={{ transform: `translate3d(${dragPosition.x}px, ${dragPosition.y}px, 0)` }}
        >
          <div className="drag-ghost-name">{dragPreview.name}</div>
          <div className="drag-ghost-code">{codes[dragPreview.id] ?? "------"}</div>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        isVisible={isSettingsVisible}
        onClose={closeSettings}
        periodSeconds={PERIOD_SECONDS}
      />

      <AddTotpModal
        isOpen={isAddOpen}
        isVisible={isAddVisible}
        name={addName}
        secret={addSecret}
        onNameChange={setAddName}
        onSecretChange={setAddSecret}
        onClose={closeAdd}
        onSubmit={handleAddSubmit}
        onScanResult={handleScanResult}
      />

      <RenameTotpModal
        isOpen={isRenameOpen}
        isVisible={isRenameVisible}
        name={renameName}
        onNameChange={setRenameName}
        onClose={closeRename}
        onSubmit={handleRenameSubmit}
      />

      <DeleteTotpModal
        isOpen={isDeleteOpen}
        isVisible={isDeleteVisible}
        name={items.find((item) => item.id === deleteId)?.name ?? ""}
        onClose={closeDelete}
        onConfirm={() => {
          if (deleteId) {
            handleDelete(deleteId)
          }
        }}
      />

      <ContextMenu
        isOpen={contextMenu.isOpen && contextMenuItems.length > 0}
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenuItems}
      />
    </div>
  )
}
