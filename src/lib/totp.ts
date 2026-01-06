const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const keyCache = new Map<string, CryptoKey>()

export function normalizeBase32(value: string) {
  return value.replace(/\s|-/g, "").toUpperCase()
}

export function base32ToBytes(value: string) {
  const cleaned = normalizeBase32(value).replace(/=+$/g, "")
  let bits = 0
  let buffer = 0
  const out: number[] = []

  for (const ch of cleaned) {
    const idx = base32Alphabet.indexOf(ch)
    if (idx === -1) {
      return null
    }
    buffer = (buffer << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((buffer >> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  if (out.length === 0) {
    return null
  }
  return new Uint8Array(out)
}

export function bytesToBase32(bytes: Uint8Array) {
  let output = ""
  let bits = 0
  let buffer = 0

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      const index = (buffer >> (bits - 5)) & 0x1f
      output += base32Alphabet[index]
      bits -= 5
    }
  }

  if (bits > 0) {
    const index = (buffer << (5 - bits)) & 0x1f
    output += base32Alphabet[index]
  }

  return output
}

async function getHmacKey(secret: string) {
  const normalized = normalizeBase32(secret)
  const cached = keyCache.get(normalized)
  if (cached) {
    return cached
  }
  const bytes = base32ToBytes(normalized)
  if (!bytes) {
    return null
  }
  const key = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  )
  keyCache.set(normalized, key)
  return key
}

function formatCode(value: number, digits: number) {
  const padded = value.toString().padStart(digits, "0")
  if (digits % 2 === 0 && digits >= 6) {
    const split = digits / 2
    return `${padded.slice(0, split)} ${padded.slice(split)}`
  }
  return padded
}

export async function generateTotp(
  secret: string,
  period: number,
  digits: number,
  nowMs: number,
) {
  const key = await getHmacKey(secret)
  if (!key) {
    return null
  }
  const counter = Math.floor(nowMs / 1000 / period)
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  const high = Math.floor(counter / 0x100000000)
  const low = counter % 0x100000000
  view.setUint32(0, high)
  view.setUint32(4, low)
  const signature = await crypto.subtle.sign("HMAC", key, buffer)
  const hash = new Uint8Array(signature)
  const offset = hash[hash.length - 1] & 0x0f
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  const mod = Math.pow(10, digits)
  return formatCode(binary % mod, digits)
}
