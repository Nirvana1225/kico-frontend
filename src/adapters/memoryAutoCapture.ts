/* ===== 记忆自动捕捉服务 =====
 * 统一的自动捕捉入口，供各页面（Chat/Cinema/CoRead等）调用。
 * 自动去重、限频，避免同一内容反复写入。
 * ===== */

import { writeMemory } from './memoryWriter'
import { evaluateMemory } from './memoryRules'

// ── 限频：同内容30秒内不重复写 ──
const recentKeys = new Map<string, number>()
const COOLDOWN_MS = 30_000

function canWrite(content: string): boolean {
  const key = content.replace(/\s+/g, '').slice(0, 80)
  const now = Date.now()
  const last = recentKeys.get(key)
  if (last && now - last < COOLDOWN_MS) return false
  recentKeys.set(key, now)
  // 清理过期
  for (const [k, t] of recentKeys) {
    if (now - t > COOLDOWN_MS * 2) recentKeys.delete(k)
  }
  return true
}

// ── 核心捕捉函数 ──

export interface CaptureParams {
  content: string
  source: '对话' | '观影' | '共读' | '情绪' | '手动'
  personaName?: string
  sessionTitle?: string
  existingTags?: string[]
}

/** 捕捉一条记忆（自动评估分类/重要性/去重） */
export async function captureMemory(params: CaptureParams): Promise<boolean> {
  if (!params.content || params.content.length < 10) return false
  if (!canWrite(params.content)) return false

  // 规则引擎评估
  const rule = evaluateMemory(params.content, params.existingTags)

  // 去重命中跳过
  if (rule.dedupKey) return false

  const tags = [params.source, params.personaName || 'AI', ...rule.tags].filter(Boolean)

  if (params.sessionTitle) {
    tags.push(params.sessionTitle)
  }

  const ok = await writeMemory({
    content: params.content.slice(0, 500), // 截断过长内容
    category: rule.category,
    importance: rule.importance,
    tags: [...new Set(tags)],
    mem_type: 'message',
  })

  return ok
}

// ── 批量捕捉（对话摘要等场景）──

export interface BatchCaptureItem {
  content: string
  tags?: string[]
}

export async function captureBatch(
  items: BatchCaptureItem[],
  source: CaptureParams['source'],
  personaName?: string,
  sessionTitle?: string,
): Promise<number> {
  let saved = 0
  for (const item of items) {
    const ok = await captureMemory({
      content: item.content,
      source,
      personaName,
      sessionTitle,
      existingTags: item.tags,
    })
    if (ok) saved++
  }
  return saved
}

// ── 观影/共读场景捕捉 ──

export async function captureWatchSession(
  title: string,
  watchMode: 'cinema' | 'coread',
  highlights: string[],
  personaName?: string,
): Promise<number> {
  const source = watchMode === 'cinema' ? '观影' : '共读'
  const items = highlights.map(text => ({
    content: `[${source}] ${title}: ${text}`,
    tags: [source, title],
  }))
  return captureBatch(items, source, personaName, title)
}

/** 情绪快照捕捉 */
export async function captureMoodSnapshot(
  mood: string,
  note: string,
): Promise<boolean> {
  return captureMemory({
    content: `[情绪记录] ${mood}: ${note || '无备注'}`,
    source: '情绪',
    existingTags: ['情绪', mood],
  })
}