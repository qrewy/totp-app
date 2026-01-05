export type ParsedOtpAuth = {
  name: string
  secret: string
  issuer?: string
  digits?: number
  period?: number
}

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
