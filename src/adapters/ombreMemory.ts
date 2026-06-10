import type { MemorySnippet } from '../types'

const SUPABASE_URL = 'https://gixkmgrdeccsqgjdbzce.supabase.co/functions/v1/mcp-memory-gateway'

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

/** 通过 Supabase REST API 查询记忆 */
export async function queryMemoryByText(query: string, limit = 10): Promise<MemorySnippet[]> {
  try {
    const rawResults = await supabasePost<Array<{
      id: string
      content: string
      category: string
      importance: number
      mem_type: string
      tags: string[]
      created_at: string
      updated_at?: string
    }>>('/api/search', {
      keyword: query || '*',
      limit: Math.min(limit, 50),
    })

    return (rawResults ?? []).map((r, i) => ({
      id: r.id || `mem-${i}`,
      title: r.category || '记忆片段',
      text: r.content || '',
      score: r.importance ? r.importance / 5 : 0,
      source: 'supabase',
    }))
  } catch (err) {
    console.warn('Supabase memory query failed:', err)
    return []
  }
}

/** 获取记忆统计 */
export async function getMemoryStats(): Promise<{ total_memories: number; categories: Record<string, number> }> {
  try {
    return await supabasePost('/api/stats')
  } catch {
    return { total_memories: 0, categories: {} }
  }
}

/** 获取单条记忆详情 */
export async function getMemoryById(memoryId: string): Promise<Record<string, unknown> | null> {
  try {
    return await supabasePost('/api/get', { memory_id: memoryId })
  } catch {
    return null
  }
}

/** 列出日记列表 */
export async function listDiaries(limit = 20, offset = 0): Promise<Record<string, unknown>[]> {
  try {
    return await supabasePost('/api/diaries', { limit, offset })
  } catch {
    return []
  }
}

/** 获取单篇日记 */
export async function getDiaryById(diaryId: string): Promise<Record<string, unknown> | null> {
  try {
    return await supabasePost('/api/diary', { diary_id: diaryId })
  } catch {
    return null
  }
}

/** 获取完整对话历史 */
export async function getConversationHistory(sessionId: string, limit = 50): Promise<Record<string, unknown>> {
  try {
    return await supabasePost('/api/conversation/history', { session_id: sessionId, limit })
  } catch {
    return { messages: [], total: 0, session_id: sessionId }
  }
}