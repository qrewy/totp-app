export type TotpItem = {
  id: string
  name: string
  secret: string
  code?: string
  issuer?: string
  digits?: number
  period?: number
}
