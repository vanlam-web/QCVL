export type AccessConnectionState = 'connecting' | 'connected' | 'disconnected'

export interface RealtimeChannel {
  on(
    type: 'postgres_changes',
    filter: { event: '*'; schema: 'public'; table: string; filter: string },
    callback: () => void,
  ): RealtimeChannel
  subscribe(callback: (status: string) => void): RealtimeChannel
  unsubscribe(): void
}

export interface RealtimeClient {
  channel(name: string): RealtimeChannel
  removeChannel(channel: RealtimeChannel): void
}

export function subscribeAccessChanges({
  client,
  userId,
  onSignal,
  onConnectionChange,
}: {
  client: RealtimeClient
  userId: string
  onSignal: () => void
  onConnectionChange?: (state: AccessConnectionState) => void
}) {
  onConnectionChange?.('connecting')
  const filter = `user_id=eq.${userId}`
  const channel = client
    .channel(`access:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter }, onSignal)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_permissions', filter }, onSignal)
    .subscribe((status) => {
      onConnectionChange?.(status === 'SUBSCRIBED' ? 'connected' : 'disconnected')
    })

  return () => {
    channel.unsubscribe()
    client.removeChannel(channel)
  }
}
