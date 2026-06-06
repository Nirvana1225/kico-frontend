/* ===== 对话写入记忆库（OmbreBrain MCP） ===== */

import type { ConversationMessage } from '../types'

const GATEWAY_URL = 'https://mr-blinds-hose.zeabur.app'

export interface WriteMemoryParams {
  content: string
  category?: string
  importance?: number
  tags?: string[]
  mem_type?: 'anchor' | 'diary' | 'treasure' | 'message'
}

/** 向 OmbreBrain 写入一条记忆 */
export async function writeMemory(params: WriteMemoryParams): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'tools/call',
        params: {
          name: 'create_memory',
          arguments: {
            content: params.content,
            category: params.category || '对话记录',
            importance: params.importance ?? 3,
            tags: params.tags || [],
            mem_type: params.mem_type || 'message',
          },
        },
      }),
    })

    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return true
  } catch (err) {
    console.warn('OmbreBrain write failed:', err)
    return false
  }
}

/** 从对话中提取关键内容写入记忆 */
export async function saveConversationHighlights(
  conversationTitle: string,
  messages: ConversationMessage[],
  personaName: string,
): Promise<number> {
  let saved = 0

  // 只取最后几轮有意义的对话写入
  const recentMessages = messages.slice(-6)
  for (const msg of recentMessages) {
    if (msg.text.length < 10) continue // 太短不写
    if (msg.role === 'user') {
      const ok = await writeMemory({
        content: `[与 ${personaName} 的对话] 用户提问: ${msg.text.slice(0, 200)}`,
        category: '对话记录',
        importance: 2,
        tags: ['对话', personaName, conversationTitle],
        mem_type: 'message',
      })
      if (ok) saved++
    }
  }

  // 写一条对话摘要
  if (messages.length >= 4) {
    const summary = messages
      .slice(-4)
      .map(m => `${m.role === 'user' ? '问' : '答'}: ${m.text.slice(0, 80)}`)
      .join(' | ')

    await writeMemory({
      content: `[对话片段] ${conversationTitle}: ${summary}`,
      category: '对话记录',
      importance: 3,
      tags: ['对话', '摘要', personaName, conversationTitle],
      mem_type: 'diary',
    })
    saved++
  }

  return saved
}