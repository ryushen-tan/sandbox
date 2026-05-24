import { type RefObject, useEffect, useRef, useState } from 'react'

export function useWebcam(videoRef: RefObject<HTMLVideoElement | null>) {
  const [isReady, setIsReady] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.onloadeddata = () => { if (!cancelled) setIsReady(true) }
        } else {
          stream.getTracks().forEach((t) => t.stop())
        }
      })
      .catch((err) => console.error('[useWebcam]', err))

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      const video = videoRef.current
      if (video) video.srcObject = null
    }
  }, [videoRef])

  return { isReady, stream: streamRef.current }
}
