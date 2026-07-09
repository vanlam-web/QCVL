const chartWidth = 640
const chartHeight = 180
const chartInnerHeight = 136
const chartPaddingY = 24

export function dashboardWavePath(points: number[]) {
  return dashboardChartPoints(points)
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')
}

export function dashboardChartPoints(points: number[]) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const step = chartWidth / (points.length - 1)
  return points.map((point, index) => ({
    x: index * step,
    y: chartHeight - chartPaddingY - ((point - min) / (max - min || 1)) * chartInnerHeight,
  }))
}
