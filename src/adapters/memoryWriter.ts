/* ===== 对话写入记忆库（Supabase REST API） ===== */

import type { ConversationMessage } from '../types'

const SUPABASE_URL = 'https://gixkmgrdeccsqgjdbzce.supabase.co/functions/v1/mcp-memory-gateway'

export interface WriteMemoryParams {
  content: string
  category?: string
  importance?: number
  tags?: string[]
  mem_type?: 'anchor' | 'diary' | 'treasure' | 'message'
}

async function supabasePost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Supabase API ${path} error ${res.status}: ${errText}`)
  }
  return res.json()
}

/** 向 Supabase 记忆库写入一条记忆 */
export async function writeMemory(params: WriteMemoryParams): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      content: params.content,
      category: params.category || '对话记录',
      importance: params.importance ?? 3,
      mem_type: params.mem_type || 'message',
      tags: JSON.stringify(params.tags || []),
    }

    const result = await supabasePost('/api/create', body)
    return !!result
  } catch (err) {
    console.warn('Supabase memory write failed:', err)
    return false
  }
}

/** 更新已有记忆 */
export async function updateMemory(memoryId: string, updates: { content?: string; importance?: number }): Promise<boolean> {
  try {
    const result = await supabasePost('/api/update', { memory_id: memoryId, ...updates })
    return !!result
  } catch {
    return false
  }
}

/** 删除记忆 */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  try {
    const result = await supabasePost('/api/delete', { memory_id: memoryId })
    return result && typeof result === 'object' && 'success' in result
  } catch {
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