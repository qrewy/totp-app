import type { TotpItem } from "../types"
import { decryptString, encryptString } from "./cryptoStorage"

const STORAGE_KEY = "totp_items_v1"
const DEFAULT_ITEMS: TotpItem[] = []
const DEFAULT_PERIOD = 30

function normalizeItem(raw: TotpItem): TotpItem | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.name !== "string") {
    return null
  }
  const secret = typeof raw.secret === "string" ? raw.secret : ""
  const code = typeof raw.code === "string" ? raw.code : ""
  const issuer = typeof raw.issuer === "string" ? raw.issuer : undefined
  const digits = typeof raw.digits === "number" ? raw.digits : 6
  const period = typeof raw.period === "number" ? raw.period : DEFAULT_PERIOD
  return {
    id: raw.id,
    name: raw.name,
    secret,
    code,
    issuer,
    digits,
    period,
  }
}

export async function loadItems(): Promise<TotpItem[]> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    return DEFAULT_ITEMS
  }
  try {
    const json = await decryptString(stored)
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) {
      return DEFAULT_ITEMS
    }
    const normalized = parsed
      .map((item: TotpItem) => normalizeItem(item))
      .filter((item): item is TotpItem => Boolean(item))
    return normalized
  } catch {
    return DEFAULT_ITEMS
  }
}

export async function saveItems(items: TotpItem[]) {
  const payload = await encryptString(JSON.stringify(items))
  localStorage.setItem(STORAGE_KEY, payload)
}
