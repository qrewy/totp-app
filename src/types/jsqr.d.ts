declare module "jsqr" {
  type QrResult = { data: string }

  function jsQR(data: Uint8ClampedArray, width: number, height: number): QrResult | null

  export default jsQR
}
