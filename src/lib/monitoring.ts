type LogLevel = 'info' | 'warn' | 'error'

interface MetricPoint {
  ts: number
  value: number
  tags?: Record<string, string | number | boolean>
}

const metricStore = new Map<string, MetricPoint[]>()

function writeLog(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...(data || {}),
  }
  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => writeLog('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => writeLog('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => writeLog('error', event, data),
}

export function recordMetric(
  name: string,
  value: number,
  tags?: Record<string, string | number | boolean>
) {
  const points = metricStore.get(name) || []
  points.push({ ts: Date.now(), value, tags })
  const windowStart = Date.now() - 5 * 60 * 1000
  const trimmed = points.filter((p) => p.ts >= windowStart)
  metricStore.set(name, trimmed)
}

export function metricSnapshot(name: string, windowMs = 60_000) {
  const points = metricStore.get(name) || []
  const start = Date.now() - windowMs
  const inWindow = points.filter((p) => p.ts >= start)
  const count = inWindow.length
  const sum = inWindow.reduce((acc, p) => acc + p.value, 0)
  const avg = count > 0 ? sum / count : 0
  return { count, sum, avg }
}
