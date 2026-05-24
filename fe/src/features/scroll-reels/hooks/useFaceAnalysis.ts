import { type RefObject, useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface FaceAnalysisState {
  smileDetected: boolean
  faceDetected: boolean
  isLoading: boolean
}

const THRESHOLD = ((100 - 80) / 100) * 0.8 + 0.1  // sensitivity 80 → threshold 0.26

export function useFaceAnalysis(
  videoRef: RefObject<HTMLVideoElement | null>,
  isReady: boolean,
): FaceAnalysisState {
  const [isLoading, setIsLoading] = useState(true)
  const [detection, setDetection] = useState({ smileDetected: false, faceDetected: false })

  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimestampRef = useRef<number>(-1)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
      )
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      })
      if (!cancelled) {
        landmarkerRef.current = landmarker
        setIsLoading(false)
      }
    }

    init().catch((err: unknown) => {
      console.error('[useFaceAnalysis] model load failed:', err)
      if (!cancelled) setIsLoading(false)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      landmarkerRef.current?.close()
    }
  }, [])

  useEffect(() => {
    if (!isReady || isLoading) return

    lastTimestampRef.current = -1

    function loop(timestamp: number) {
      if (!videoRef.current || !landmarkerRef.current) return
      if (timestamp === lastTimestampRef.current) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      lastTimestampRef.current = timestamp

      const result = landmarkerRef.current.detectForVideo(videoRef.current, timestamp)
      const shapes = result.faceBlendshapes?.[0]?.categories

      if (!shapes) {
        setDetection({ smileDetected: false, faceDetected: false })
      } else {
        const left  = shapes.find((c) => c.categoryName === 'mouthSmileLeft')?.score  ?? 0
        const right = shapes.find((c) => c.categoryName === 'mouthSmileRight')?.score ?? 0
        setDetection({
          smileDetected: (left + right) / 2 > THRESHOLD,
          faceDetected: true,
        })
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isReady, isLoading, videoRef])

  return { ...detection, isLoading }
}
