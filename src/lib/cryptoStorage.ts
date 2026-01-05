import { fromBase64, toBase64 } from "./encoding"

const KEY_STORAGE = "totp_items_key_v1"

async function getOrCreateKey() {
  const stored = localStorage.getItem(KEY_STORAGE)
  if (stored) {
    return crypto.subtle.importKey("raw", fromBase64(stored), "AES-GCM", true, [
      "encrypt",
      "decrypt",
    ])
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ])
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key))
  localStorage.setItem(KEY_STORAGE, toBase64(raw))
  return key
}

export async function encryptString(value: string) {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(value)
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
  return JSON.stringify({
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  })
}

export async function decryptString(payload: string) {
  const parsed = JSON.parse(payload)
  if (!parsed?.iv || !parsed?.data) {
    throw new Error("Invalid payload")
  }
  const key = await getOrCreateKey()
  const iv = fromBase64(parsed.iv)
  const data = fromBase64(parsed.data)
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)
  return new TextDecoder().decode(plain)
}
