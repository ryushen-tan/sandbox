import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env['VITE_SOCKET_URL'] ?? 'http://localhost:8000'

let _socket: Socket | null = null

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(SOCKET_URL, { autoConnect: true })
  }
  return _socket
}

export function disconnectSocket(): void {
  _socket?.disconnect()
  _socket = null
}
