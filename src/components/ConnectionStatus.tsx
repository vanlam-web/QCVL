export function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span
      aria-label="connection status"
      className="connection-status-dot"
      data-connected={connected ? 'true' : 'false'}
      title={connected ? 'Đã kết nối' : 'Mất kết nối'}
    />
  )
}
