import { useEffect, useRef, useState } from 'react'
import { getSocket } from '../socket'

export type RoomPhase =
  | { type: 'idle' }
  | { type: 'waiting'; code: string }
  | { type: 'battle'; isHost: boolean }
  | { type: 'ended'; won: boolean }

export function useRoom() {
  const [phase, setPhase] = useState<RoomPhase>({ type: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const socket = useRef(getSocket()).current

  useEffect(() => {
    socket.on('room-created', ({ code }: { code: string }) => {
      setPhase({ type: 'waiting', code })
    })
    socket.on('match-ready', ({ isHost }: { isHost: boolean }) => {
      setPhase({ type: 'battle', isHost })
    })
    socket.on('join-error', ({ message }: { message: string }) => {
      setError(message)
    })
    socket.on('match-ended', ({ won }: { won: boolean }) => {
      setPhase({ type: 'ended', won })
    })
    socket.on('opponent-disconnected', () => {
      setError('Opponent disconnected')
      setPhase({ type: 'idle' })
    })

    return () => {
      socket.off('room-created')
      socket.off('match-ready')
      socket.off('join-error')
      socket.off('match-ended')
      socket.off('opponent-disconnected')
    }
  }, [socket])

  function createRoom() {
    setError(null)
    socket.emit('create-room')
  }

  function joinRoom(code: string) {
    setError(null)
    socket.emit('join-room', { code: code.toUpperCase().trim() })
  }

  function reset() {
    setPhase({ type: 'idle' })
    setError(null)
  }

  return { phase, error, createRoom, joinRoom, reset }
}
