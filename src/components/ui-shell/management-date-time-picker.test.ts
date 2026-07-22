import { describe, expect, it } from 'vitest'
import { managementDateTimeCalendarDays, managementDateTimeTimeOptions } from './management-date-time-picker'

describe('management date time picker helpers', () => {
  it('builds monday-first calendar grids with configurable week count', () => {
    const month = new Date(2026, 6, 1)

    const fiveWeekGrid = managementDateTimeCalendarDays(month)
    const sixWeekGrid = managementDateTimeCalendarDays(month, 6)

    expect(fiveWeekGrid).toHaveLength(35)
    expect(sixWeekGrid).toHaveLength(42)
    expect(fiveWeekGrid[0]).toEqual(new Date(2026, 5, 29))
    expect(sixWeekGrid[41]).toEqual(new Date(2026, 7, 9))
  })

  it('uses shared half-hour time options', () => {
    expect(managementDateTimeTimeOptions).toHaveLength(48)
    expect(managementDateTimeTimeOptions[0]).toBe('00:00')
    expect(managementDateTimeTimeOptions[1]).toBe('00:30')
    expect(managementDateTimeTimeOptions[47]).toBe('23:30')
  })
})
