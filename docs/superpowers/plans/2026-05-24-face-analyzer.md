# Face Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained React feature that streams webcam video, detects smiles in-browser via MediaPipe Face Landmarker, and emits `player:laughed` via Socket.io on each smile onset.

**Architecture:** Feature module at `fe/src/features/face-analyzer/` with three focused hooks (webcam, analysis, socket) wired by a thin UI shell. MediaPipe runs entirely in-browser via WASM — no API key, no network calls for inference. Socket.io fires only on rising edge (false→true) to avoid flooding. Wired directly into `App.tsx` (no router needed for this single-page sandbox).

**Tech Stack:** React 19, TypeScript, `@mediapipe/tasks-vision`, `socket.io-client`, shadcn/ui (Card, Slider), Tailwind CSS v4, Vite, Vitest + jsdom + @testing-library/react.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `fe/vite.config.ts` | Modify | Add vitest test config |
| `fe/package.json` | Modify | New deps + test script |
| `fe/src/components/ui/slider.tsx` | Create (shadcn) | Slider primitive |
| `fe/src/components/ui/card.tsx` | Create (shadcn) | Card primitive |
| `fe/src/features/face-analyzer/hooks/useWebcam.ts` | Create | Camera stream setup/teardown |
| `fe/src/features/face-analyzer/hooks/__tests__/useWebcam.test.ts` | Create | Tests for useWebcam |
| `fe/src/features/face-analyzer/hooks/useFaceAnalysis.ts` | Create | MediaPipe model + RAF loop + blendshape scoring |
| `fe/src/features/face-analyzer/hooks/__tests__/useFaceAnalysis.test.ts` | Create | Tests for pure helper functions |
| `fe/src/features/face-analyzer/hooks/useSmileSocket.ts` | Create | Socket.io client + rising-edge emit |
| `fe/src/features/face-analyzer/hooks/__tests__/useSmileSocket.test.ts` | Create | Tests for rising-edge behavior |
| `fe/src/features/face-analyzer/FaceAnalyzer.tsx` | Create | Thin UI shell, wires all hooks |
| `fe/src/features/face-analyzer/index.ts` | Create | Barrel export |
| `fe/src/App.tsx` | Modify | Render FaceAnalyzer |

---

## Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `fe/package.json` (via npm)
- Modify: `fe/vite.config.ts`
- Create: `fe/src/components/ui/slider.tsx` (via shadcn)
- Create: `fe/src/components/ui/card.tsx` (via shadcn)

- [ ] **Step 1: Install runtime packages**

```bash
cd fe && npm install @mediapipe/tasks-vision socket.io-client
```

Expected: packages added, no peer dep errors.

- [ ] **Step 2: Install test packages**

```bash
cd fe && npm install -D vitest @vitest/globals jsdom @testing-library/react @testing-library/user-event
```

Expected: devDependencies updated.

- [ ] **Step 3: Add shadcn Card and Slider components**

```bash
cd fe && npx shadcn@latest add card slider
```

Expected: `fe/src/components/ui/card.tsx` and `fe/src/components/ui/slider.tsx` created.

- [ ] **Step 4: Add vitest config to `fe/vite.config.ts`**

Replace the entire file with:

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    alias: {
      '@/': path.resolve(__dirname, './src/'),
    },
  },
})
```

- [ ] **Step 5: Add test script to `fe/package.json`**

In the `"scripts"` section, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify Vitest runs (no test files yet)**

```bash
cd fe && npm test
```

Expected: output like `No test files found` — not an error exit, just zero tests.

- [ ] **Step 7: Commit**

```bash
git add fe/package.json fe/package-lock.json fe/vite.config.ts fe/src/components/ui/card.tsx fe/src/components/ui/slider.tsx
git commit -m "chore: install mediapipe, socket.io-client, vitest; add Card and Slider"
```

---

## Task 2: `useWebcam` hook

**Files:**
- Create: `fe/src/features/face-analyzer/hooks/useWebcam.ts`
- Create: `fe/src/features/face-analyzer/hooks/__tests__/useWebcam.test.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p fe/src/features/face-analyzer/hooks/__tests__
```

- [ ] **Step 2: Write the failing test**

Create `fe/src/features/face-analyzer/hooks/__tests__/useWebcam.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWebcam } from '../useWebcam'

const mockTrackStop = vi.fn()
const mockStream = {
  getTracks: () => [{ stop: mockTrackStop }],
}

beforeEach(() => {
  mockTrackStop.mockClear()
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(mockStream) },
    configurable: true,
  })
})

describe('useWebcam', () => {
  it('returns isReady=true and error=null when camera access is granted', async () => {
    const videoRef = { current: { srcObject: null } as unknown as HTMLVideoElement }
    const { result } = renderHook(() => useWebcam(videoRef))
    await act(async () => {})
    expect(result.current.isReady).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('attaches stream to videoRef.current.srcObject', async () => {
    const videoElement = { srcObject: null } as unknown as HTMLVideoElement
    const videoRef = { current: videoElement }
    renderHook(() => useWebcam(videoRef))
    await act(async () => {})
    expect(videoRef.current.srcObject).toBe(mockStream)
  })

  it('returns error string when getUserMedia is rejected', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')) },
      configurable: true,
    })
    const videoRef = { current: { srcObject: null } as unknown as HTMLVideoElement }
    const { result } = renderHook(() => useWebcam(videoRef))
    await act(async () => {})
    expect(result.current.isReady).toBe(false)
    expect(result.current.error).toBe('Camera access denied. Please allow camera permissions.')
  })

  it('stops all tracks on unmount', async () => {
    const videoRef = { current: { srcObject: null } as unknown as HTMLVideoElement }
    const { unmount } = renderHook(() => useWebcam(videoRef))
    await act(async () => {})
    unmount()
    expect(mockTrackStop).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd fe && npm test -- src/features/face-analyzer/hooks/__tests__/useWebcam.test.ts
```

Expected: FAIL — `Cannot find module '../useWebcam'`

- [ ] **Step 4: Write `useWebcam`**

Create `fe/src/features/face-analyzer/hooks/useWebcam.ts`:

```typescript
import { type RefObject, useEffect, useState } from 'react'

interface WebcamState {
  isReady: boolean
  error: string | null
}

export function useWebcam(videoRef: RefObject<HTMLVideoElement>): WebcamState {
  const [state, setState] = useState<WebcamState>({ isReady: false, error: null })

  useEffect(() => {
    let stream: MediaStream | null = null

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
        }
        setState({ isReady: true, error: null })
      })
      .catch(() => {
        setState({ isReady: false, error: 'Camera access denied. Please allow camera permissions.' })
      })

    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [videoRef])

  return state
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd fe && npm test -- src/features/face-analyzer/hooks/__tests__/useWebcam.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add fe/src/features/face-analyzer/hooks/useWebcam.ts fe/src/features/face-analyzer/hooks/__tests__/useWebcam.test.ts
git commit -m "feat: add useWebcam hook"
```

---

## Task 3: `useFaceAnalysis` hook

Tests cover the two exported pure functions (`sensitivityToThreshold`, `isSmile`). The hook itself uses `requestAnimationFrame` and MediaPipe WASM — both require a real browser and are covered by manual verification in Task 6.

**Files:**
- Create: `fe/src/features/face-analyzer/hooks/useFaceAnalysis.ts`
- Create: `fe/src/features/face-analyzer/hooks/__tests__/useFaceAnalysis.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `fe/src/features/face-analyzer/hooks/__tests__/useFaceAnalysis.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { sensitivityToThreshold, isSmile } from '../useFaceAnalysis'

describe('sensitivityToThreshold', () => {
  it('maps sensitivity 0 → threshold 0.9 (least sensitive)', () => {
    expect(sensitivityToThreshold(0)).toBeCloseTo(0.9, 5)
  })

  it('maps sensitivity 50 → threshold 0.5 (middle)', () => {
    expect(sensitivityToThreshold(50)).toBeCloseTo(0.5, 5)
  })

  it('maps sensitivity 100 → threshold 0.1 (most sensitive)', () => {
    expect(sensitivityToThreshold(100)).toBeCloseTo(0.1, 5)
  })

  it('always returns a value between 0.1 and 0.9', () => {
    for (let s = 0; s <= 100; s += 10) {
      const t = sensitivityToThreshold(s)
      expect(t).toBeGreaterThanOrEqual(0.1)
      expect(t).toBeLessThanOrEqual(0.9)
    }
  })
})

describe('isSmile', () => {
  it('returns true when average of left and right exceeds threshold', () => {
    expect(isSmile(0.7, 0.8, 0.5)).toBe(true)
  })

  it('returns false when average is exactly equal to threshold', () => {
    expect(isSmile(0.5, 0.5, 0.5)).toBe(false)
  })

  it('returns false when average is below threshold', () => {
    expect(isSmile(0.2, 0.3, 0.5)).toBe(false)
  })

  it('returns false when both scores are 0', () => {
    expect(isSmile(0, 0, 0.5)).toBe(false)
  })

  it('handles asymmetric left/right scores correctly', () => {
    // avg(0.8, 0.2) = 0.5, threshold 0.49 → true
    expect(isSmile(0.8, 0.2, 0.49)).toBe(true)
    // avg(0.8, 0.2) = 0.5, threshold 0.51 → false
    expect(isSmile(0.8, 0.2, 0.51)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd fe && npm test -- src/features/face-analyzer/hooks/__tests__/useFaceAnalysis.test.ts
```

Expected: FAIL — `Cannot find module '../useFaceAnalysis'`

- [ ] **Step 3: Write `useFaceAnalysis`**

Create `fe/src/features/face-analyzer/hooks/useFaceAnalysis.ts`:

```typescript
import { type RefObject, useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export function sensitivityToThreshold(sensitivity: number): number {
  return ((100 - sensitivity) / 100) * 0.8 + 0.1
}

export function isSmile(left: number, right: number, threshold: number): boolean {
  return (left + right) / 2 > threshold
}

interface FaceAnalysisState {
  smileDetected: boolean
  faceDetected: boolean
  isLoading: boolean
}

export function useFaceAnalysis(
  videoRef: RefObject<HTMLVideoElement>,
  sensitivity: number,
  isReady: boolean,
): FaceAnalysisState {
  const [state, setState] = useState<FaceAnalysisState>({
    smileDetected: false,
    faceDetected: false,
    isLoading: true,
  })

  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimestampRef = useRef<number>(-1)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
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
        setState((s) => ({ ...s, isLoading: false }))
      }
    }

    init().catch(() => {
      if (!cancelled) {
        setState({ smileDetected: false, faceDetected: false, isLoading: false })
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      landmarkerRef.current?.close()
    }
  }, [])

  useEffect(() => {
    if (!isReady) return

    const threshold = sensitivityToThreshold(sensitivity)

    function loop(timestamp: number) {
      if (!videoRef.current || !landmarkerRef.current) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      if (timestamp === lastTimestampRef.current) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      lastTimestampRef.current = timestamp

      const result = landmarkerRef.current.detectForVideo(videoRef.current, timestamp)
      const shapes = result.faceBlendshapes?.[0]?.categories

      if (!shapes || result.faceBlendshapes?.length === 0) {
        setState({ smileDetected: false, faceDetected: false, isLoading: false })
      } else {
        const left = shapes.find((c) => c.categoryName === 'mouthSmileLeft')?.score ?? 0
        const right = shapes.find((c) => c.categoryName === 'mouthSmileRight')?.score ?? 0
        setState({
          smileDetected: isSmile(left, right, threshold),
          faceDetected: true,
          isLoading: false,
        })
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isReady, sensitivity, videoRef])

  return state
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd fe && npm test -- src/features/face-analyzer/hooks/__tests__/useFaceAnalysis.test.ts
```

Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add fe/src/features/face-analyzer/hooks/useFaceAnalysis.ts fe/src/features/face-analyzer/hooks/__tests__/useFaceAnalysis.test.ts
git commit -m "feat: add useFaceAnalysis hook with MediaPipe"
```

---

## Task 4: `useSmileSocket` hook

**Files:**
- Create: `fe/src/features/face-analyzer/hooks/useSmileSocket.ts`
- Create: `fe/src/features/face-analyzer/hooks/__tests__/useSmileSocket.test.ts`

- [ ] **Step 1: Write the failing test**

Create `fe/src/features/face-analyzer/hooks/__tests__/useSmileSocket.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockEmit, mockSocket } = vi.hoisted(() => {
  const mockEmit = vi.fn()
  const mockSocket = {
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'connect') cb()
    }),
    off: vi.fn(),
    emit: mockEmit,
    disconnect: vi.fn(),
    connected: true,
  }
  return { mockEmit, mockSocket }
})

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

import { useSmileSocket } from '../useSmileSocket'

beforeEach(() => {
  mockEmit.mockClear()
  mockSocket.on.mockClear()
  mockSocket.off.mockClear()
  mockSocket.disconnect.mockClear()
})

describe('useSmileSocket', () => {
  it('emits player:laughed on rising edge (false → true)', async () => {
    const { rerender } = renderHook(({ smile }) => useSmileSocket(smile), {
      initialProps: { smile: false },
    })
    await act(async () => rerender({ smile: true }))
    expect(mockEmit).toHaveBeenCalledWith('player:laughed')
    expect(mockEmit).toHaveBeenCalledTimes(1)
  })

  it('does not re-emit while smile is sustained', async () => {
    const { rerender } = renderHook(({ smile }) => useSmileSocket(smile), {
      initialProps: { smile: false },
    })
    await act(async () => rerender({ smile: true })) // rising edge — 1 emit
    mockEmit.mockClear()
    await act(async () => rerender({ smile: true })) // sustained — no emit
    await act(async () => rerender({ smile: true }))
    expect(mockEmit).toHaveBeenCalledTimes(0)
  })

  it('emits again on a second rising edge after smile drops', async () => {
    const { rerender } = renderHook(({ smile }) => useSmileSocket(smile), {
      initialProps: { smile: false },
    })
    await act(async () => rerender({ smile: true }))  // 1st onset
    await act(async () => rerender({ smile: false })) // smile drops
    mockEmit.mockClear()
    await act(async () => rerender({ smile: true }))  // 2nd onset
    expect(mockEmit).toHaveBeenCalledWith('player:laughed')
    expect(mockEmit).toHaveBeenCalledTimes(1)
  })

  it('returns connected=true when socket connects', async () => {
    const { result } = renderHook(() => useSmileSocket(false))
    await act(async () => {})
    expect(result.current.connected).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd fe && npm test -- src/features/face-analyzer/hooks/__tests__/useSmileSocket.test.ts
```

Expected: FAIL — `Cannot find module '../useSmileSocket'`

- [ ] **Step 3: Write `useSmileSocket`**

Create `fe/src/features/face-analyzer/hooks/useSmileSocket.ts`:

```typescript
import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = 'http://localhost:3001'

interface SmileSocketState {
  connected: boolean
}

export function useSmileSocket(smileDetected: boolean): SmileSocketState {
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const prevSmileRef = useRef(false)

  useEffect(() => {
    const socket = io(SOCKET_URL, { autoConnect: true })
    socketRef.current = socket

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    if (smileDetected && !prevSmileRef.current) {
      socketRef.current?.emit('player:laughed')
    }
    prevSmileRef.current = smileDetected
  }, [smileDetected])

  return { connected }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd fe && npm test -- src/features/face-analyzer/hooks/__tests__/useSmileSocket.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add fe/src/features/face-analyzer/hooks/useSmileSocket.ts fe/src/features/face-analyzer/hooks/__tests__/useSmileSocket.test.ts
git commit -m "feat: add useSmileSocket hook with rising-edge emit"
```

---

## Task 5: `FaceAnalyzer` component and barrel export

**Files:**
- Create: `fe/src/features/face-analyzer/FaceAnalyzer.tsx`
- Create: `fe/src/features/face-analyzer/index.ts`

- [ ] **Step 1: Create `FaceAnalyzer.tsx`**

Create `fe/src/features/face-analyzer/FaceAnalyzer.tsx`:

```tsx
import { useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useWebcam } from './hooks/useWebcam'
import { useFaceAnalysis } from './hooks/useFaceAnalysis'
import { useSmileSocket } from './hooks/useSmileSocket'

function getStatusText(isLoading: boolean, faceDetected: boolean, smileDetected: boolean): string {
  if (isLoading) return 'Initializing model…'
  if (!faceDetected) return 'No face detected'
  if (smileDetected) return 'Smile detected'
  return 'Straight face'
}

function getIndicatorClass(isLoading: boolean, faceDetected: boolean, smileDetected: boolean): string {
  if (isLoading || !faceDetected) return 'bg-muted-foreground/30'
  if (smileDetected) return 'bg-red-500 shadow-red-500/50 shadow-lg'
  return 'bg-green-500 shadow-green-500/50 shadow-lg'
}

export function FaceAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [sensitivity, setSensitivity] = useState(50)

  const { isReady, error } = useWebcam(videoRef)
  const { smileDetected, faceDetected, isLoading } = useFaceAnalysis(videoRef, sensitivity, isReady)
  useSmileSocket(smileDetected)

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-3">
        <div className="px-1">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Face Analyzer
          </p>
        </div>

        <Card className="overflow-hidden border-border/50">
          <div className="relative bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div
              className={cn(
                'absolute bottom-3 right-3 w-3.5 h-3.5 rounded-full ring-2 ring-background transition-all duration-200',
                getIndicatorClass(isLoading, faceDetected, smileDetected),
              )}
            />
          </div>

          <CardContent className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground min-h-[1.25rem]">
              {error ?? getStatusText(isLoading, faceDetected, smileDetected)}
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Sensitivity</span>
                <span className="text-sm tabular-nums text-muted-foreground">{sensitivity}</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[sensitivity]}
                onValueChange={([v]) => setSensitivity(v)}
                disabled={isLoading}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Big laughs only</span>
                <span>Any smile</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create barrel export**

Create `fe/src/features/face-analyzer/index.ts`:

```typescript
export { FaceAnalyzer } from './FaceAnalyzer'
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd fe && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add fe/src/features/face-analyzer/FaceAnalyzer.tsx fe/src/features/face-analyzer/index.ts
git commit -m "feat: add FaceAnalyzer UI component"
```

---

## Task 6: Wire into App.tsx and verify

**Files:**
- Modify: `fe/src/App.tsx`

- [ ] **Step 1: Update `fe/src/App.tsx`**

Replace the entire file with:

```tsx
import { FaceAnalyzer } from '@/features/face-analyzer'

function App() {
  return <FaceAnalyzer />
}

export default App
```

- [ ] **Step 2: Run all tests**

```bash
cd fe && npm test
```

Expected: all tests pass (green).

- [ ] **Step 3: Start dev server and verify in browser**

```bash
cd fe && npm run dev
```

Open `http://localhost:5173`. Verify:
- [ ] Browser prompts for camera permission — grant it
- [ ] Webcam feed appears in the card
- [ ] Status reads "Initializing model…" for a few seconds while WASM loads
- [ ] Indicator dot is gray during load
- [ ] Once loaded: indicator turns green, status reads "Straight face"
- [ ] When you smile: indicator turns red, status reads "Smile detected"
- [ ] Moving out of frame: status reads "No face detected", indicator goes gray
- [ ] Sliding sensitivity left (low) — only big grins trigger; right (high) — small smiles trigger
- [ ] Browser console shows Socket.io connection attempt to `localhost:3001` (connection failure is expected and silent)

- [ ] **Step 4: Commit**

```bash
git add fe/src/App.tsx
git commit -m "feat: wire FaceAnalyzer into App"
```
