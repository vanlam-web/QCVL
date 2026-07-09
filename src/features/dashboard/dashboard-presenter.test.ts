import { describe, expect, it } from 'vitest'
import { dashboardChartPoints, dashboardWavePath } from './dashboard-presenter'

describe('dashboard presenter', () => {
  it('builds chart points and paths outside the dashboard page', () => {
    expect(dashboardChartPoints([1, 2, 3])).toHaveLength(3)
    expect(dashboardWavePath([1, 2, 3])).toMatch(/^M /)
  })
})
