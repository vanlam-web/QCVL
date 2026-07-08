import { render } from '@testing-library/react'
import { AccessSync } from './AccessSync'
import type { RealtimeChannel } from '../../lib/realtime/access-channel'

it('coalesces duplicate realtime events into one refresh and removes channel on unmount', async () => {
  let signal: () => void = () => undefined
  const unsubscribe = vi.fn()
  const removeChannel = vi.fn()
  const channel: RealtimeChannel = {
    on: (_type, _filter, callback) => {
      signal = callback
      return channel
    },
    subscribe: () => channel,
    unsubscribe,
  }
  let resolveRefresh: () => void = () => undefined
  const refreshMe = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveRefresh = resolve
      }),
  )
  const { unmount } = render(
    <AccessSync
      client={{ channel: () => channel, removeChannel }}
      userId="u-1"
      refreshMe={refreshMe}
    />,
  )

  signal()
  signal()
  expect(refreshMe).toHaveBeenCalledTimes(1)
  resolveRefresh()
  await Promise.resolve()
  unmount()
  expect(unsubscribe).toHaveBeenCalled()
  expect(removeChannel).toHaveBeenCalledWith(channel)
})
