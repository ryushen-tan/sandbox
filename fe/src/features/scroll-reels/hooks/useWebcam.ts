import { type RefObject, useEffect, useState } from 'react'

interface WebcamState {
  isReady: boolean
  error: string | null
}

export function useWebcam(videoRef: RefObject<HTMLVideoElement | null>): WebcamState {
  const [state, setState] = useState<WebcamState>({ isReady: false, error: null })

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    const videoEl = videoRef.current

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        stream = s
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        if (videoEl) {
          videoEl.srcObject = s
          videoEl.onloadeddata = () => {
            if (!cancelled) setState({ isReady: true, error: null })
          }
        } else {
          s.getTracks().forEach((t) => t.stop())
        }
      })
      .catch(() => {
        if (!cancelled) setState({ isReady: false, error: 'Camera unavailable' })
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      if (videoEl) videoEl.srcObject = null
    }
  }, [videoRef])

  return state
}
