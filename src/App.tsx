import type { FormEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { invoke } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { AddButton } from "./components/AddButton"
import { AddTotpModal } from "./components/AddTotpModal"
import { ContextMenu } from "./components/ContextMenu"
import { DeleteTotpModal } from "./components/DeleteTotpModal"
import { ExportQrModal } from "./components/ExportQrModal"
import { RenameTotpModal } from "./components/RenameTotpModal"
import { SettingsModal } from "./components/SettingsModal"
import { Toast } from "./components/Toast"
import { Topbar } from "./components/Topbar"
import { TotpList } from "./components/TotpList"
import { useNowRaf } from "./hooks/useNowRaf"
import { useI18n } from "./lib/i18n"
import { loadItems, saveItems } from "./lib/itemsStorage"
import { type OtpScanResult } from "./lib/otpauth"
import { base32ToBytes, generateTotp, normalizeBase32 } from "./lib/totp"
import QRCode from "qrcode"
import type { TotpItem } from "./types"
import "./index.css"
import "./styles/context-menu.css"
import "./styles/drag.css"
import "./styles/modal.css"

const PERIOD_SECONDS = 30
const EXPORT_FILE_PREFIX = "totp-export"
const OTP_ALGORITHM_SHA1 = 1
const OTP_DIGITS_6 = 1
const OTP_DIGITS_8 = 2
const OTP_TYPE_TOTP = 2
const PIN_HASH_KEY = "totp_pin_hash_v1"
const PIN_SALT_KEY = "totp_pin_salt_v1"
const BLUR_CODES_KEY = "totp_blur_codes_v1"
const CLOSE_TO_TRAY_KEY = "totp_close_to_tray_v1"
const IDLE_TIMEOUT_MS = 5 * 60 * 1000

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

async function hashPin(pin: string, salt: Uint8Array) {
  const encoder = new TextEncoder()
  const pinBytes = encoder.encode(pin)
  const combined = new Uint8Array(salt.length + pinBytes.length)
  combined.set(salt, 0)
  combined.set(pinBytes, salt.length)
  const digest = await crypto.subtle.digest("SHA-256", combined)
  return bytesToBase64(new Uint8Array(digest))
}

// function sanitizeFilename(value: string) {
//   const trimmed = value.trim()
//   if (!trimmed) {
//     return "totp"
//   }
//   return trimmed.replace(/[^a-z0-9_-]+/gi, "_")
// }

function buildOtpAuthUri(item: TotpItem) {
  if (!item.secret) {
    return null
  }
  const secret = normalizeBase32(item.secret)
  if (!base32ToBytes(secret)) {
    return null
  }
  const params = new URLSearchParams({ secret })
  if (item.issuer) {
    params.set("issuer", item.issuer)
  }
  if (item.digits && item.digits !== 6) {
    params.set("digits", String(item.digits))
  }
  if (item.period && item.period !== PERIOD_SECONDS) {
    params.set("period", String(item.period))
  }
  const label = item.issuer ? `${item.issuer}:${item.name}` : item.name
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function base64Encode(bytes: Uint8Array) {
  return bytesToBase64(bytes)
}

function pushVarint(out: number[], value: number) {
  let val = value >>> 0
  while (val >= 0x80) {
    out.push((val & 0x7f) | 0x80)
    val >>>= 7
  }
  out.push(val)
}

function pushFieldKey(out: number[], field: number, wire: number) {
  pushVarint(out, (field << 3) | wire)
}

function pushBytes(out: number[], bytes: Uint8Array) {
  pushVarint(out, bytes.length)
  for (const byte of bytes) {
    out.push(byte)
  }
}

function pushString(out: number[], value: string) {
  const encoded = new TextEncoder().encode(value)
  pushBytes(out, encoded)
}

function buildOtpParameters(item: TotpItem) {
  const secret = normalizeBase32(item.secret ?? "")
  const secretBytes = base32ToBytes(secret)
  if (!secretBytes) {
    return null
  }
  const out: number[] = []
  pushFieldKey(out, 1, 2)
  pushBytes(out, secretBytes)
  pushFieldKey(out, 2, 2)
  const label = item.issuer ? `${item.issuer}:${item.name}` : item.name
  pushString(out, label)
  if (item.issuer) {
    pushFieldKey(out, 3, 2)
    pushString(out, item.issuer)
  }
  pushFieldKey(out, 4, 0)
  pushVarint(out, OTP_ALGORITHM_SHA1)
  pushFieldKey(out, 5, 0)
  pushVarint(out, item.digits === 8 ? OTP_DIGITS_8 : OTP_DIGITS_6)
  pushFieldKey(out, 6, 0)
  pushVarint(out, OTP_TYPE_TOTP)
  return new Uint8Array(out)
}

function buildMigrationPayload(
  items: TotpItem[],
  batchIndex: number,
  batchSize: number,
  batchId: number,
) {
  const out: number[] = []
  let hasParams = false
  for (const item of items) {
    const params = buildOtpParameters(item)
    if (!params) {
      continue
    }
    hasParams = true
    pushFieldKey(out, 1, 2)
    pushBytes(out, params)
  }
  if (!hasParams) {
    return new Uint8Array()
  }
  pushFieldKey(out, 2, 0)
  pushVarint(out, 1)
  pushFieldKey(out, 3, 0)
  pushVarint(out, batchSize)
  pushFieldKey(out, 4, 0)
  pushVarint(out, batchIndex)
  pushFieldKey(out, 5, 0)
  pushVarint(out, batchId)
  return new Uint8Array(out)
}

function buildMigrationUri(
  items: TotpItem[],
  batchIndex: number,
  batchSize: number,
  batchId: number,
) {
  const payload = buildMigrationPayload(items, batchIndex, batchSize, batchId)
  if (!payload.length) {
    return null
  }
  const data = encodeURIComponent(base64Encode(payload))
  return `otpauth-migration://offline?data=${data}`
}

function chunkItems(items: TotpItem[], size: number) {
  const chunks: TotpItem[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

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
  const exportCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exportOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isExportVisible, setIsExportVisible] = useState(false)
  const [exportSelectedIds, setExportSelectedIds] = useState<string[]>([])
  const [exportQrEntries, setExportQrEntries] = useState<
    { id: string; title: string; dataUrl: string }[]
  >([])
  const [searchQuery, setSearchQuery] = useState("")
  const [blurCodes, setBlurCodes] = useState(true)
  const [closeToTray, setCloseToTray] = useState(true)
  const [appVersion, setAppVersion] = useState("")
  const [hasPin, setHasPin] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false)
  const [isPinOverlayOpen, setIsPinOverlayOpen] = useState(false)
  const [isPinOverlayVisible, setIsPinOverlayVisible] = useState(false)
  const [pinMode, setPinMode] = useState<"enter" | "set" | "confirm">("enter")
  const [pinValue, setPinValue] = useState("")
  const [pinConfirm, setPinConfirm] = useState("")
  const [pinError, setPinError] = useState("")
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
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActiveRef = useRef<number>(Date.now())
  const pinOverlayCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pinOverlayOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    itemId: null as string | null,
  })

  const nowSec = useMemo(() => nowMs / 1000, [nowMs])
  const normalizedSearch = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery])
  const filteredItems = useMemo(() => {
    if (!normalizedSearch) {
      return items
    }
    return items.filter((item) => {
      const name = item.name.toLowerCase()
      const issuer = item.issuer?.toLowerCase() ?? ""
      return name.includes(normalizedSearch) || issuer.includes(normalizedSearch)
    })
  }, [items, normalizedSearch])

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
    const storedHash = localStorage.getItem(PIN_HASH_KEY)
    const storedSalt = localStorage.getItem(PIN_SALT_KEY)
    if (storedHash && storedSalt) {
      setHasPin(true)
      setIsLocked(true)
      setPinMode("enter")
    } else {
      setHasPin(false)
    }
  }, [])

  useEffect(() => {
    getVersion()
      .then((version) => setAppVersion(version))
      .catch(() => null)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(BLUR_CODES_KEY)
    if (stored === "0") {
      setBlurCodes(false)
    } else if (stored === "1") {
      setBlurCodes(true)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(CLOSE_TO_TRAY_KEY)
    const next = stored === "0" ? false : true
    setCloseToTray(next)
    void invoke("set_close_to_tray", { enabled: next }).catch(() => null)
  }, [])

  useEffect(() => {
    const shouldOpen = isLocked || isPinSetupOpen
    if (shouldOpen) {
      setIsPinOverlayOpen(true)
      setIsPinOverlayVisible(false)
      if (pinOverlayCloseTimerRef.current) {
        clearTimeout(pinOverlayCloseTimerRef.current)
        pinOverlayCloseTimerRef.current = null
      }
      if (pinOverlayOpenTimerRef.current) {
        clearTimeout(pinOverlayOpenTimerRef.current)
      }
      pinOverlayOpenTimerRef.current = setTimeout(() => {
        setIsPinOverlayVisible(true)
        pinOverlayOpenTimerRef.current = null
      }, 10)
      return () => undefined
    }

    if (pinOverlayOpenTimerRef.current) {
      clearTimeout(pinOverlayOpenTimerRef.current)
      pinOverlayOpenTimerRef.current = null
    }
    setIsPinOverlayVisible(false)
    if (pinOverlayCloseTimerRef.current) {
      clearTimeout(pinOverlayCloseTimerRef.current)
    }
    pinOverlayCloseTimerRef.current = setTimeout(() => {
      setIsPinOverlayOpen(false)
      pinOverlayCloseTimerRef.current = null
    }, 180)
    return () => undefined
  }, [isLocked, isPinSetupOpen])

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

  const openExport = useCallback((presetIds?: string[]) => {
    const ids = presetIds?.length ? presetIds : items.map((item) => item.id)
    setExportSelectedIds(ids)
    setExportQrEntries([])
    setIsExportOpen(true)
    setIsExportVisible(false)
    if (exportCloseTimerRef.current) {
      clearTimeout(exportCloseTimerRef.current)
      exportCloseTimerRef.current = null
    }
    if (exportOpenTimerRef.current) {
      clearTimeout(exportOpenTimerRef.current)
    }
    exportOpenTimerRef.current = setTimeout(() => {
      setIsExportVisible(true)
      exportOpenTimerRef.current = null
    }, 10)
  }, [items])

  const closeExport = useCallback(() => {
    if (!isExportOpen) {
      return
    }
    setIsExportVisible(false)
    if (exportOpenTimerRef.current) {
      clearTimeout(exportOpenTimerRef.current)
      exportOpenTimerRef.current = null
    }
    if (exportCloseTimerRef.current) {
      clearTimeout(exportCloseTimerRef.current)
    }
    exportCloseTimerRef.current = setTimeout(() => {
      setIsExportOpen(false)
      exportCloseTimerRef.current = null
    }, 180)
  }, [isExportOpen])

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

  const lockApp = useCallback(() => {
    if (!hasPin) {
      return
    }
    setIsLocked(true)
    setIsPinSetupOpen(false)
    setPinMode("enter")
    setPinValue("")
    setPinConfirm("")
    setPinError("")
    closeSettings()
    closeAdd()
    closeRename()
    closeDelete()
    closeExport()
  }, [closeAdd, closeDelete, closeExport, closeRename, closeSettings, hasPin])

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

  useEffect(() => {
    if (!hasPin || isLocked) {
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current)
        idleTimerRef.current = null
      }
      return
    }
    lastActiveRef.current = Date.now()
    const handleActivity = () => {
      lastActiveRef.current = Date.now()
    }
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"]
    events.forEach((event) => window.addEventListener(event, handleActivity))
    idleTimerRef.current = setInterval(() => {
      if (Date.now() - lastActiveRef.current >= IDLE_TIMEOUT_MS) {
        lockApp()
      }
    }, 1000)
    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity))
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }
  }, [hasPin, isLocked, lockApp])

  const handleCopy = async (code: string) => {
    try {
      const value = code.replace(/\s/g, "")
      await navigator.clipboard.writeText(value)
      showToast(t("toast.copied"))
    } catch {
      showToast(t("toast.copy_failed"))
    }
  }

  const handleExportItem = useCallback(
    (item: TotpItem) => {
      openExport([item.id])
    },
    [openExport],
  )

  const handleExportAll = useCallback(() => {
    const uris = exportSelectedIds
      .map((id) => items.find((item) => item.id === id))
      .map((item) => (item ? buildOtpAuthUri(item) : null))
      .filter(Boolean) as string[]
    if (!uris.length) {
      showToast(t("toast.export_empty"))
      return
    }
    const date = new Date().toISOString().slice(0, 10)
    downloadTextFile(`${EXPORT_FILE_PREFIX}-${date}.txt`, uris.join("\n"))
    showToast(t("toast.exported"))
  }, [exportSelectedIds, items, showToast, t])

  const handleExportToggle = useCallback((id: string) => {
    setExportSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    )
  }, [])

  const handleExportToggleAll = useCallback(() => {
    setExportSelectedIds((prev) => {
      if (prev.length === items.length) {
        return []
      }
      return items.map((item) => item.id)
    })
  }, [items])

  const handleBlurToggle = useCallback(() => {
    setBlurCodes((prev) => {
      const next = !prev
      localStorage.setItem(BLUR_CODES_KEY, next ? "1" : "0")
      return next
    })
  }, [])

  const handleCloseToTrayToggle = useCallback(() => {
    setCloseToTray((prev) => {
      const next = !prev
      localStorage.setItem(CLOSE_TO_TRAY_KEY, next ? "1" : "0")
      void invoke("set_close_to_tray", { enabled: next }).catch(() => null)
      return next
    })
  }, [])

  const openPinSetup = useCallback(() => {
    setPinMode("set")
    setPinValue("")
    setPinConfirm("")
    setPinError("")
    setIsPinSetupOpen(true)
  }, [])

  const closePinSetup = useCallback(() => {
    if (!isPinSetupOpen) {
      return
    }
    setIsPinSetupOpen(false)
    setPinValue("")
    setPinConfirm("")
    setPinError("")
  }, [isPinSetupOpen])

  const removePin = useCallback(() => {
    localStorage.removeItem(PIN_HASH_KEY)
    localStorage.removeItem(PIN_SALT_KEY)
    setHasPin(false)
    setIsLocked(false)
    setIsPinSetupOpen(false)
    setPinMode("enter")
    setPinValue("")
    setPinConfirm("")
    setPinError("")
    showToast(t("toast.pin_removed"))
  }, [showToast, t])

  const handlePinSubmit = useCallback(async () => {
    if (pinMode === "enter") {
      const storedHash = localStorage.getItem(PIN_HASH_KEY)
      const storedSalt = localStorage.getItem(PIN_SALT_KEY)
      if (!storedHash || !storedSalt) {
        setHasPin(false)
        setIsLocked(false)
        setPinError("")
        return
      }
      const saltBytes = base64ToBytes(storedSalt)
      const hashed = await hashPin(pinValue, saltBytes)
      if (hashed === storedHash) {
        setIsLocked(false)
        setPinValue("")
        setPinConfirm("")
        setPinError("")
        showToast(t("toast.pin_unlocked"))
      } else {
        setPinError(t("pin.error_invalid"))
      }
      return
    }
    if (pinMode === "set") {
      if (pinValue.trim().length < 4) {
        setPinError(t("pin.error_short"))
        return
      }
      setPinError("")
      setPinConfirm("")
      setPinMode("confirm")
      return
    }
    if (pinMode === "confirm") {
      if (pinConfirm.trim() !== pinValue.trim()) {
        setPinError(t("pin.error_mismatch"))
        return
      }
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const hashed = await hashPin(pinValue.trim(), salt)
      localStorage.setItem(PIN_HASH_KEY, hashed)
      localStorage.setItem(PIN_SALT_KEY, bytesToBase64(salt))
      setHasPin(true)
      setIsPinSetupOpen(false)
      setIsLocked(false)
      setPinMode("enter")
      setPinValue("")
      setPinConfirm("")
      setPinError("")
      showToast(t("toast.pin_set"))
    }
  }, [pinConfirm, pinMode, pinValue, showToast, t])

  const handleDownloadQrs = useCallback(() => {
    if (!exportQrEntries.length) {
      showToast(t("toast.export_empty"))
      return
    }
    exportQrEntries.forEach((entry, index) => {
      const filename = `totp-qr-${String(index + 1).padStart(2, "0")}.png`
      downloadDataUrl(filename, entry.dataUrl)
    })
    showToast(t("toast.exported"))
  }, [exportQrEntries, showToast, t])

  useEffect(() => {
    let active = true
    if (!isExportOpen) {
      return () => undefined
    }
    const build = async () => {
      const selected = exportSelectedIds
        .map((id) => items.find((entry) => entry.id === id))
        .filter((entry): entry is TotpItem => Boolean(entry))
      if (!selected.length) {
        if (active) {
          setExportQrEntries([])
        }
        return
      }
      const batchId = crypto.getRandomValues(new Uint32Array(1))[0]
      const chunks = chunkItems(selected, 10)
      try {
        const entries = await Promise.all(
          chunks.map(async (chunk, index) => {
            const uri = buildMigrationUri(chunk, index, chunks.length, batchId)
            if (!uri) {
              return null
            }
            const dataUrl = await QRCode.toDataURL(uri, {
              errorCorrectionLevel: "L",
              width: 320,
              margin: 2,
              color: {
                dark: "#000000",
                light: "#ffffff",
              },
            })
            const title = t("export.batch", {
              index: String(index + 1),
              total: String(chunks.length),
            })
            return { id: `batch-${index}`, title, dataUrl }
          }),
        )
        const filtered = entries.filter(Boolean) as typeof exportQrEntries
        if (active) {
          setExportQrEntries(filtered)
        }
      } catch {
        if (active) {
          setExportQrEntries([])
        }
      }
    }
    void build()
    return () => {
      active = false
    }
  }, [exportSelectedIds, isExportOpen, items, t])

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
    const menuHeight = 128
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
    (payload: OtpScanResult) => {
      if (payload.type === "single") {
        setAddName(payload.entry.name)
        setAddSecret(payload.entry.secret)
        showToast(t("toast.scan_loaded"))
        return
      }
      setItems((prev) => {
        const timestamp = Date.now()
        const next = [
          ...prev,
          ...payload.entries.map((entry, index) => ({
            id:
              typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${timestamp}-${index}`,
            name: entry.name,
            secret: normalizeBase32(entry.secret),
            digits: entry.digits ?? 6,
            period: entry.period ?? PERIOD_SECONDS,
            issuer: entry.issuer,
          })),
        ]
        void saveItems(next)
        return next
      })
      closeAdd()
      showToast(t("toast.scan_loaded"))
    },
    [closeAdd, showToast, t],
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
        id: "export",
        label: t("menu.export"),
        onClick: () => {
          closeContextMenu()
          handleExportItem(item)
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
  }, [closeContextMenu, contextMenu.itemId, handleExportItem, items, openDelete, openRename, t])

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
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return
      }
      if (isLocked) {
        return
      }
      closeContextMenu()
      closeSettings()
      closeAdd()
      closeRename()
      closeDelete()
      closeExport()
    }
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("keydown", handleKey)
    }
  }, [
    closeAdd,
    closeContextMenu,
    closeDelete,
    closeExport,
    closeRename,
    closeSettings,
    isLocked,
  ])

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
      if (exportCloseTimerRef.current) {
        clearTimeout(exportCloseTimerRef.current)
      }
      if (exportOpenTimerRef.current) {
        clearTimeout(exportOpenTimerRef.current)
      }
      if (ghostTimerRef.current) {
        clearTimeout(ghostTimerRef.current)
      }
      if (pinOverlayCloseTimerRef.current) {
        clearTimeout(pinOverlayCloseTimerRef.current)
      }
      if (pinOverlayOpenTimerRef.current) {
        clearTimeout(pinOverlayOpenTimerRef.current)
      }
    }
  }, [])

  return (
    <div className={`app ${blurCodes ? "blur-codes" : ""}`}>
      <Topbar
        onSettings={openSettings}
        onLock={lockApp}
        showLock={hasPin && !isLocked}
        settingsDisabled={isLocked}
        onMinimize={handleMinimize}
        onClose={handleClose}
      />

      <main className="content">
        <div className="totp-search">
          <span className="totp-search-icon" aria-hidden="true" />
          <input
            className="totp-search-input"
            placeholder={t("search.placeholder")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <TotpList
          items={filteredItems}
          codes={codes}
          nowSec={nowSec}
          defaultPeriod={PERIOD_SECONDS}
          searchQuery={searchQuery}
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
        onExportAll={() => openExport()}
        hasPin={hasPin}
        onSetPin={openPinSetup}
        onRemovePin={removePin}
        blurCodes={blurCodes}
        onToggleBlur={handleBlurToggle}
        closeToTray={closeToTray}
        onToggleCloseToTray={handleCloseToTrayToggle}
        appVersion={appVersion}
      />

      <ExportQrModal
        isOpen={isExportOpen}
        isVisible={isExportVisible}
        items={items}
        selectedIds={exportSelectedIds}
        qrEntries={exportQrEntries}
        onToggle={handleExportToggle}
        onToggleAll={handleExportToggleAll}
        onDownload={handleExportAll}
        onDownloadQrs={handleDownloadQrs}
        onClose={closeExport}
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
      {isPinOverlayOpen && (
        <div
          className={`pin-overlay ${isPinOverlayVisible ? "is-open" : "is-closing"}`}
          role="dialog"
          aria-modal="true"
        >
          <div className={`pin-card ${isPinOverlayVisible ? "is-open" : "is-closing"}`}>
            <div className="pin-title">
              {pinMode === "enter"
                ? t("pin.enter_title")
                : pinMode === "set"
                  ? t("pin.set_title")
                  : t("pin.confirm_title")}
            </div>
            {isLocked && <div className="pin-subtitle">{t("pin.locked_hint")}</div>}
            <input
              className={`pin-input ${pinError ? "is-error" : ""}`}
              type="text"
              inputMode="numeric"
              autoFocus
              value={pinMode === "confirm" ? pinConfirm : pinValue}
              onChange={(event) => {
                setPinError("")
                if (pinMode === "confirm") {
                  setPinConfirm(event.target.value)
                } else {
                  setPinValue(event.target.value)
                }
              }}
              placeholder={t("pin.placeholder")}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handlePinSubmit()
                }
                if (event.key === "Escape" && !isLocked) {
                  closePinSetup()
                }
              }}
            />
            <div className="pin-actions">
              {!isLocked && (
                <button className="modal-submit is-secondary" type="button" onClick={closePinSetup}>
                  {t("actions.cancel")}
                </button>
              )}
              <button className="modal-submit" type="button" onClick={handlePinSubmit}>
                {pinMode === "enter" ? t("actions.unlock") : t("actions.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
