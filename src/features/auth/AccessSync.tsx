import { useEffect, useRef } from 'react'
import {
  subscribeAccessChanges,
  type AccessConnectionState,
  type RealtimeClient,
} from '../../lib/realtime/access-channel'

export function AccessSync({
  client,
  userId,
  refreshMe,
  onConnectionChange,
}: {
  client: RealtimeClient
  userId: string | null
  refreshMe: () => Promise<void>
  onConnectionChange?: (state: AccessConnectionState) => void
}) {
  const inFlight = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (!userId) return undefined

    return subscribeAccessChanges({
      client,
      userId,
      onConnectionChange,
      onSignal: () => {
        inFlight.current ??= refreshMe().finally(() => {
          inFlight.current = null
        })
      },
    })
  }, [client, onConnectionChange, refreshMe, userId])

  return null
}
