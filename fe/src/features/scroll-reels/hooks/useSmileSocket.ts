import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env['VITE_SOCKET_URL'] ?? 'http://localhost:3001'

export function useSmileSocket(smileDetected: boolean): void {
  const socketRef = useRef<Socket | null>(null)
  const prevSmileRef = useRef(smileDetected)

  useEffect(() => {
    const socket = io(SOCKET_URL, { autoConnect: true })
    socketRef.current = socket
    return () => { socket.disconnect() }
  }, [])

  useEffect(() => {
    if (smileDetected && !prevSmileRef.current) {
      socketRef.current?.emit('player:laughed')
    }
    prevSmileRef.current = smileDetected
  }, [smileDetected])
}
