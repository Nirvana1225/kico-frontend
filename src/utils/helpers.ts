export function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}