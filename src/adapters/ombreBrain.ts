/* ===== OmbreBrain 网关 MCP 适配层 ===== */

const GATEWAY_URL = 'https://mr-blinds-hose.zeabur.app'

export interface MCPResponse {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

/** 通用 MCP 调用 */
async function mcpCall<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tools/call',
      params: { name: method, arguments: params ?? {} }
    })
  })
  const data: MCPResponse = await res.json()
  if (data.error) throw new Error(`MCP Error: ${data.error.message}`)
  return data.result as T
}

/** MCP 可用工具列表 */
export async function listTools(): Promise<string[]> {
  const res = await fetch(`${GATEWAY_URL}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tools/list',
      params: {}
    })
  })
  const data = await res.json()
  return data.result?.tools?.map((t: { name: string }) => t.name) ?? []
}

/** 聊天补全（流式） */
export async function chatCompletion(
  model: string,
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true
    })
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Chat API Error: ${res.status} ${errText}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

    for (const line of lines) {
      const data = line.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content ?? ''
        if (content) {
          fullContent += content
          onChunk(content)
        }
      } catch {
        // skip parse errors for incomplete chunks
      }
    }
  }

  return fullContent
}

/** 查询记忆 */
export async function queryMemory(query: string, limit = 10): Promise<unknown[]> {
  return mcpCall<unknown[]>('query_memory', { query, limit })
}

/** 创建记忆 */
export async function createMemory(content: string, tags?: string[]): Promise<{ id: string }> {
  return mcpCall<{ id: string }>('create_memory', {
    content,
    tags: tags ?? []
  })
}

/** 获取记忆详情 */
export async function getMemory(title: string): Promise<unknown> {
  return mcpCall('get_memory_by_title', { title })
}

/** 心跳检测 */
export async function heartbeat(): Promise<{ status: string; total: number }> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/trigger/heartbeat`)
  return res.json()
}