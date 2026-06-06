import type { MemorySnippet } from '../types'

const GATEWAY_URL = 'https://mr-blinds-hose.zeabur.app'

/** 通过网关 MCP 查询记忆 */
export async function queryMemoryByText(query: string, limit = 10): Promise<MemorySnippet[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: {
          name: 'search_memories',
          arguments: { keyword: query, limit: Math.min(limit, 20) },
        },
      }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message)

    const rawResults = data.result as Array<{
      id?: string
      title?: string
      content?: string
      text?: string
      score?: number
      source?: string
      category?: string
      importance?: number
    }> ?? []

    return rawResults.map((r, i) => ({
      id: r.id || `mem-${i}`,
      title: r.title || r.category || '记忆片段',
      text: r.content || r.text || '',
      score: r.importance ? r.importance / 5 : (r.score ?? 0),
      source: r.source || 'ombrebrain',
    }))
  } catch (err) {
    console.warn('OmbreBrain query failed:', err)
    return []
  }
}

/** 网关心跳检测 */
export async function checkGatewayHealth(): Promise<{ status: string; total: number }> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/trigger/heartbeat`)
  return res.json()
}

/** 获取网关可用工具列表 */
export async function listGatewayTools(): Promise<string[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/list',
        params: {},
      }),
    })
    const data = await res.json()
    return data.result?.tools?.map((t: { name: string }) => t.name) ?? []
  } catch {
    return []
  }
}