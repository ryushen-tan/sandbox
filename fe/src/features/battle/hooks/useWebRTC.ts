import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }]

export function useWebRTC(
  socket: Socket,
  isHost: boolean,
  active: boolean,
  localStream: MediaStream | null,
) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    if (!active || !localStream) return

    const pc = new RTCPeerConnection({ iceServers: ICE })
    pcRef.current = pc

    const remote = new MediaStream()
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => remote.addTrack(t))
      setRemoteStream(new MediaStream(remote.getTracks()))
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('ice-candidate', { candidate: e.candidate })
    }

    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream))

    socket.on('ice-candidate', async ({ candidate }) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch (_) {}
    })

    if (isHost) {
      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('offer', { sdp: pc.localDescription })
      }
      socket.on('answer', async ({ sdp }) => {
        if (pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        }
      })
    } else {
      socket.on('offer', async ({ sdp }) => {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('answer', { sdp: pc.localDescription })
      })
    }

    return () => {
      socket.off('ice-candidate')
      socket.off('offer')
      socket.off('answer')
      pc.close()
      pcRef.current = null
      setRemoteStream(null)
    }
  }, [active, localStream, isHost, socket])

  return { remoteStream }
}
