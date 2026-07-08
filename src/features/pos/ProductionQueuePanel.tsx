import { useEffect, useState } from 'react'
import { Image, Printer, Scissors } from 'lucide-react'
import { formatApiError } from '../../lib/api/error-message'
import type { ProductionQueueService } from '../production-queue/production-queue-service'
import type { ProductionQueueDraftPayload, ProductionQueueItem } from '../production-queue/types'

const machineTabs = [
  { key: 'banner', label: 'In bạt', icon: Image },
  { key: 'decal', label: 'In decal', icon: Printer },
  { key: 'cnc', label: 'Cắt CNC', icon: Scissors },
] as const

export function ProductionQueuePanel({
  service,
  onAddToDraft,
}: {
  service: ProductionQueueService
  onAddToDraft: (payload: ProductionQueueDraftPayload) => Promise<void> | void
}) {
  const [items, setItems] = useState<ProductionQueueItem[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadQueue() {
      setError(null)
      try {
        const response = await service.listQueue()
        if (active) setItems(response.items)
      } catch (cause) {
        if (active) setError(formatApiError(cause, 'Không tải được hàng đợi máy sản xuất.'))
      }
    }

    void loadQueue()

    return () => {
      active = false
    }
  }, [service])

  async function addItem(item: ProductionQueueItem) {
    setBusyId(item.id)
    setError(null)
    try {
      const payload = await service.addToDraft(item.id)
      await onAddToDraft(payload)
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
    } catch (cause) {
      setError(formatApiError(cause, 'Không thêm được file máy sản xuất vào nháp.'))
    } finally {
      setBusyId(null)
    }
  }

  const counts = Object.fromEntries(
    machineTabs.map((machine) => [
      machine.key,
      items.filter((item) => machineKey(item) === machine.key).length,
    ]),
  )

  return (
    <section aria-label="K02-D hàng đợi máy sản xuất" className="production-queue-panel">
      <div className="production-machine-tabs" aria-label="Máy sản xuất">
        {machineTabs.map((machine) => {
          const Icon = machine.icon
          const count = counts[machine.key] ?? 0
          return (
            <div key={machine.key} className="production-machine-tab">
              <span className="production-machine-icon">
                <Icon aria-hidden="true" size={18} />
              </span>
              <span>{machine.label}</span>
              {count > 0 ? <strong>{count}</strong> : null}
            </div>
          )
        })}
      </div>

      {error ? <p role="alert" className="production-queue-alert">{error}</p> : null}

      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.raw_file_name}</strong>
                <span>
                  {item.production_machine.code} - {item.production_machine.name}
                </span>
              </div>
              <button
                aria-label={`Thêm ${item.raw_file_name} vào nháp`}
                disabled={busyId === item.id || item.parse_status !== 'ok'}
                type="button"
                onClick={() => void addItem(item)}
              >
                +
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function machineKey(item: ProductionQueueItem) {
  const value = normalizeMachine(`${item.production_machine.code} ${item.production_machine.name}`)
  if (value.includes('decal')) return 'decal'
  if (value.includes('cnc') || value.includes('cat')) return 'cnc'
  if (value.includes('bat') || value.includes('bạt')) return 'banner'
  return null
}

function normalizeMachine(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
