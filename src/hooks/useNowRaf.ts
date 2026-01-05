import { useEffect, useState } from "react"

export function useNowRaf() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let raf = 0
    const loop = () => {
      setNow(Date.now())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return now
}
