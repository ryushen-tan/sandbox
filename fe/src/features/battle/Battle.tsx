import { useRef, useState } from 'react'
import { getSocket } from './socket'
import { useRoom } from './hooks/useRoom'
import { Lobby } from './components/Lobby'
import { WaitingRoom } from './components/WaitingRoom'
import { BattleScreen } from './components/BattleScreen'

export function Battle() {
  const { phase, error, createRoom, joinRoom, reset } = useRoom()
  const socket = useRef(getSocket()).current
  const [finalHp, setFinalHp] = useState({ mine: 100, opponent: 100 })

  if (phase.type === 'idle') {
    return <Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} error={error} />
  }

  if (phase.type === 'waiting') {
    return <WaitingRoom code={phase.code} onCancel={reset} />
  }

  if (phase.type === 'battle' || phase.type === 'ended') {
    const isHost = phase.type === 'battle' ? phase.isHost : false

    return (
      <BattleScreen
        socket={socket}
        isHost={isHost}
        onEnd={() => {}}
        finalHp={finalHp}
        onFinalHpChange={setFinalHp}
      />
    )
  }

  return null
}
