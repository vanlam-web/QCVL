export const managementDateTimeTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${minute}`
})

export function managementDateTimeCalendarDays(month: Date, weeks = 5) {
  const firstDate = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (firstDate.getDay() + 6) % 7
  const startDate = new Date(firstDate)
  startDate.setDate(firstDate.getDate() - offset)
  return Array.from({ length: weeks * 7 }, (_, index) => {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)
    return date
  })
}
