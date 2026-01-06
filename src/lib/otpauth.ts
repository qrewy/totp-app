import { bytesToBase32 } from "./totp"

export type ParsedOtpAuth = {
  name: string
  secret: string
  issuer?: string
  digits?: number
  period?: number
}

export type OtpScanResult =
  | { type: "single"; entry: ParsedOtpAuth }
  | { type: "multiple"; entries: ParsedOtpAuth[] }

export function parseOtpAuth(uri: string): ParsedOtpAuth | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== "otpauth:") {
      return null
    }
    if (url.hostname !== "totp") {
      return null
    }
    const label = decodeURIComponent(url.pathname.replace(/^\/+/, ""))
    const secret = url.searchParams.get("secret")
    if (!secret) {
      return null
    }
    const issuerParam = url.searchParams.get("issuer") || undefined
    const digits = url.searchParams.get("digits")
    const period = url.searchParams.get("period")
    const parts = label.split(":")
    const inferredIssuer = parts.length > 1 ? parts[0].trim() : undefined
    const name = parts.length > 1 ? parts.slice(1).join(":").trim() : label.trim()
    return {
      name: name || issuerParam || inferredIssuer || "TOTP",
      secret,
      issuer: issuerParam || inferredIssuer,
      digits: digits ? Number(digits) : undefined,
      period: period ? Number(period) : undefined,
    }
  } catch {
    return null
  }
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  const binary = atob(normalized + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

type DecodeResult = { value: number; offset: number }

function readVarint(bytes: Uint8Array, offset: number): DecodeResult | null {
  let result = 0
  let shift = 0
  let pos = offset
  while (pos < bytes.length) {
    const byte = bytes[pos]
    pos += 1
    result |= (byte & 0x7f) << shift
    if ((byte & 0x80) === 0) {
      return { value: result, offset: pos }
    }
    shift += 7
    if (shift > 56) {
      return null
    }
  }
  return null
}

function readLengthDelimited(
  bytes: Uint8Array,
  offset: number,
): { value: Uint8Array; offset: number } | null {
  const lengthResult = readVarint(bytes, offset)
  if (!lengthResult) {
    return null
  }
  const length = lengthResult.value
  const start = lengthResult.offset
  const end = start + length
  if (end > bytes.length) {
    return null
  }
  return { value: bytes.slice(start, end), offset: end }
}

function decodeOtpParameters(bytes: Uint8Array): ParsedOtpAuth | null {
  let offset = 0
  let name = ""
  let issuer: string | undefined
  let secret: Uint8Array | null = null
  let digits: number | undefined
  let type: number | undefined
  const decoder = new TextDecoder()

  while (offset < bytes.length) {
    const keyResult = readVarint(bytes, offset)
    if (!keyResult) {
      break
    }
    offset = keyResult.offset
    const field = keyResult.value >> 3
    const wire = keyResult.value & 0x7

    if (wire === 2) {
      const valueResult = readLengthDelimited(bytes, offset)
      if (!valueResult) {
        break
      }
      offset = valueResult.offset
      if (field === 1) {
        secret = valueResult.value
      } else if (field === 2) {
        name = decoder.decode(valueResult.value)
      } else if (field === 3) {
        issuer = decoder.decode(valueResult.value)
      }
    } else if (wire === 0) {
      const valueResult = readVarint(bytes, offset)
      if (!valueResult) {
        break
      }
      offset = valueResult.offset
      if (field === 5) {
        digits = valueResult.value === 2 ? 8 : 6
      } else if (field === 6) {
        type = valueResult.value
      }
    } else {
      break
    }
  }

  if (!secret) {
    return null
  }
  if (type === 1) {
    return null
  }

  const secretBase32 = bytesToBase32(secret)
  return {
    name: name || issuer || "TOTP",
    secret: secretBase32,
    issuer,
    digits,
  }
}

function parseOtpAuthMigration(uri: string): ParsedOtpAuth[] | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== "otpauth-migration:") {
      return null
    }
    const data = url.searchParams.get("data")
    if (!data) {
      return null
    }
    const bytes = base64UrlToBytes(data)
    let offset = 0
    const entries: ParsedOtpAuth[] = []
    while (offset < bytes.length) {
      const keyResult = readVarint(bytes, offset)
      if (!keyResult) {
        break
      }
      offset = keyResult.offset
      const field = keyResult.value >> 3
      const wire = keyResult.value & 0x7
      if (field === 1 && wire === 2) {
        const valueResult = readLengthDelimited(bytes, offset)
        if (!valueResult) {
          break
        }
        offset = valueResult.offset
        const entry = decodeOtpParameters(valueResult.value)
        if (entry) {
          entries.push(entry)
        }
      } else if (wire === 0) {
        const valueResult = readVarint(bytes, offset)
        if (!valueResult) {
          break
        }
        offset = valueResult.offset
      } else if (wire === 2) {
        const valueResult = readLengthDelimited(bytes, offset)
        if (!valueResult) {
          break
        }
        offset = valueResult.offset
      } else {
        break
      }
    }
    return entries.length ? entries : null
  } catch {
    return null
  }
}

export function parseOtpAuthPayload(value: string): OtpScanResult | null {
  const migration = parseOtpAuthMigration(value)
  if (migration && migration.length > 0) {
    return migration.length === 1
      ? { type: "single", entry: migration[0] }
      : { type: "multiple", entries: migration }
  }
  const parsed = parseOtpAuth(value)
  if (parsed) {
    return { type: "single", entry: parsed }
  }
  return null
}
