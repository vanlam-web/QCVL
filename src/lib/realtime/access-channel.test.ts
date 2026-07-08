import { subscribeAccessChanges, type RealtimeChannel } from './access-channel'

it('subscribes to filtered profile and permission changes and removes the channel', () => {
  const callbacks: Array<() => void> = []
  const filters: string[] = []
  const channel: RealtimeChannel = {
    on: (_type, filter, callback) => {
      filters.push(`${filter.table}:${filter.filter}`)
      callbacks.push(callback)
      return channel
    },
    subscribe: (callback) => {
      callback('SUBSCRIBED')
      return channel
    },
    unsubscribe: vi.fn(),
  }
  const removeChannel = vi.fn()
  const onSignal = vi.fn()
  const onConnectionChange = vi.fn()

  const cleanup = subscribeAccessChanges({
    client: { channel: () => channel, removeChannel },
    userId: 'u-1',
    onSignal,
    onConnectionChange,
  })

  expect(filters).toEqual(['profiles:user_id=eq.u-1', 'user_permissions:user_id=eq.u-1'])
  callbacks.forEach((callback) => callback())
  expect(onSignal).toHaveBeenCalledTimes(2)
  expect(onConnectionChange).toHaveBeenCalledWith('connected')
  cleanup()
  expect(channel.unsubscribe).toHaveBeenCalled()
  expect(removeChannel).toHaveBeenCalledWith(channel)
})
