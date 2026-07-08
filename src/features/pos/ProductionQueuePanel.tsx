import type { CSSProperties, SVGProps } from 'react'
import { useEffect, useRef, useState } from 'react'
import { formatApiError } from '../../lib/api/error-message'
import type { ProductionQueueService } from '../production-queue/production-queue-service'
import type { ProductionQueueDraftPayload, ProductionQueueItem } from '../production-queue/types'

const cncIconUrl = new URL('../../assets/machine-icons/cnc.svg', import.meta.url).href
const decalIconUrl = new URL('../../assets/machine-icons/indc.svg', import.meta.url).href
const bannerIconUrl = new URL('../../assets/machine-icons/inbat.svg', import.meta.url).href

const machineTabs = [
  { key: 'banner', label: 'In bạt', icon: BannerPrinterIcon, iconSize: 30 },
  { key: 'decal', label: 'In decal', icon: DecalPrinterIcon, iconSize: 30 },
  { key: 'cnc', label: 'Cắt CNC', icon: CncRouterIcon, iconSize: 30 },
] as const

export function ProductionQueuePanel({
  service,
  onAddToDraft,
}: {
  service: ProductionQueueService
  onAddToDraft: (payload: ProductionQueueDraftPayload) => Promise<void> | void
}) {
  const panelRef = useRef<HTMLElement | null>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const [items, setItems] = useState<ProductionQueueItem[]>([])
  const [activeMachine, setActiveMachine] = useState<(typeof machineTabs)[number]['key'] | null>(null)
  const [machineTabsWidth, setMachineTabsWidth] = useState<number | null>(null)
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

  useEffect(() => {
    if (activeMachine === null) return undefined

    function closeWhenSelectingOutsidePanel(event: PointerEvent) {
      const panel = panelRef.current
      if (panel && event.target instanceof Node && !panel.contains(event.target)) {
        setActiveMachine(null)
      }
    }

    document.addEventListener('pointerdown', closeWhenSelectingOutsidePanel)
    return () => document.removeEventListener('pointerdown', closeWhenSelectingOutsidePanel)
  }, [activeMachine])

  useEffect(() => {
    const tabsElement = tabsRef.current
    const panelElement = panelRef.current
    if (!tabsElement || !panelElement) return undefined
    const measuredTabsElement: HTMLDivElement = tabsElement
    const measuredPanelElement: HTMLElement = panelElement

    function syncMachineTabsWidth() {
      const tabsRect = measuredTabsElement.getBoundingClientRect()
      const panelRect = measuredPanelElement.getBoundingClientRect()
      const width = Math.ceil(tabsRect.right - panelRect.left)
      setMachineTabsWidth(width > 0 ? width : null)
    }

    syncMachineTabsWidth()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncMachineTabsWidth)
      observer.observe(measuredTabsElement)
    }

    window.addEventListener('resize', syncMachineTabsWidth)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', syncMachineTabsWidth)
    }
  }, [])

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
  const activeItems = activeMachine
    ? items.filter((item) => machineKey(item) === activeMachine)
    : []
  const activeMachineTab = machineTabs.find((machine) => machine.key === activeMachine) ?? null
  const panelStyle = machineTabsWidth
    ? ({ '--production-machine-tabs-width': `${machineTabsWidth}px` } as CSSProperties)
    : undefined

  return (
    <section
      aria-label="K02-D hàng đợi máy sản xuất"
      className="production-queue-panel"
      ref={panelRef}
      style={panelStyle}
    >
      <div className="production-machine-tabs" aria-label="Máy sản xuất" ref={tabsRef}>
        {machineTabs.map((machine) => {
          const Icon = machine.icon
          const count = counts[machine.key] ?? 0
          return (
            <button
              key={machine.key}
              aria-label={count > 0 ? `${machine.label} ${count}` : machine.label}
              aria-pressed={activeMachine === machine.key}
              className="production-machine-tab"
              type="button"
              onClick={() => setActiveMachine((current) => (current === machine.key ? null : machine.key))}
            >
              <span className="production-machine-icon">
                <Icon aria-hidden="true" size={machine.iconSize} />
              </span>
              <span className="production-machine-label">{machine.label}</span>
              {count > 0 ? <strong>{count}</strong> : null}
            </button>
          )
        })}
      </div>

      {error ? <p role="alert" className="production-queue-alert">{error}</p> : null}

      {activeItems.length > 0 && activeMachineTab ? (
        <ul className={`production-queue-popover production-queue-popover-${activeMachine}`}>
          {activeItems.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.raw_file_name}</strong>
                <span>
                  {item.production_machine.code} - {item.production_machine.name}
                </span>
              </div>
              <button
                aria-label={`Thêm ${item.raw_file_name} vào nháp`}
                className="production-queue-add-button"
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

function BannerPrinterIcon({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <MachineMaskIcon
      aria-hidden={props['aria-hidden']}
      iconUrl={bannerIconUrl}
      name="banner-printer"
      size={size}
    />
  )
}

function DecalPrinterIcon({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <MachineMaskIcon
      aria-hidden={props['aria-hidden']}
      iconUrl={decalIconUrl}
      name="decal-printer"
      size={size}
    />
  )
}

function CncRouterIcon({ size = 18, ...props }: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <MachineMaskIcon
      aria-hidden={props['aria-hidden']}
      iconUrl={cncIconUrl}
      name="cnc-router"
      size={size}
    />
  )
}

function MachineMaskIcon({
  iconUrl,
  name,
  size,
  ...props
}: {
  iconUrl: string
  name: string
  size: number | string
} & Pick<SVGProps<SVGSVGElement>, 'aria-hidden'>) {
  const style = {
    '--machine-icon-url': `url("${iconUrl}")`,
    height: size,
    width: size,
  } as CSSProperties

  return (
    <span
      aria-hidden={props['aria-hidden']}
      className="production-machine-mask-icon"
      data-icon={name}
      style={style}
    />
  )
}
