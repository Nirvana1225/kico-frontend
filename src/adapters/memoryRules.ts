/* ===== 记忆规则引擎 =====
 * 分类 / 去重 / 重要性评分
 * 前端调用 writeMemory 前可选执行
 * 后端 Edge Function 也可复用这套逻辑
 * ===== */

export type MemoryCategory = '对话记录' | '个人偏好' | '事实记忆' | '重要事件' | '日记' | '其他'

export interface RuleResult {
  category: MemoryCategory
  importance: number  // 1-5
  tags: string[]
  dedupKey?: string   // 去重key，相同key的跳过写入
  reason: string
}

// ── 关键词命中分类规则 ──

const CATEGORY_RULES: Array<{
  keywords: string[]
  category: MemoryCategory
  defaultImportance: number
}> = [
  { keywords: ['喜欢', '不爱', '爱吃', '讨厌', '最', '口味', '偏好'], category: '个人偏好', defaultImportance: 3 },
  { keywords: ['名字', '生日', '岁', '地址', '电话', '学校', '工作'], category: '事实记忆', defaultImportance: 4 },
  { keywords: ['重要', '记住', '别忘了', '关键', '必须'], category: '重要事件', defaultImportance: 5 },
  { keywords: ['日记', '今天', '昨天', '刚才', '下午', '上午', '晚上'], category: '日记', defaultImportance: 2 },
  { keywords: ['对话', '聊天', '问', '答'], category: '对话记录', defaultImportance: 2 },
]

// ── 去重规则 ──
// 相同内容的记忆在 N 秒内不重复写入

const DEDUP_WINDOW_MS = 5 * 60 * 1000  // 5分钟
const recentWrites = new Map<string, number>()

function checkDedup(content: string): string | null {
  // 用内容前50字作为去重key（去空格）
  const key = content.replace(/\s+/g, '').slice(0, 50)
  const lastTs = recentWrites.get(key)
  const now = Date.now()

  if (lastTs && (now - lastTs) < DEDUP_WINDOW_MS) {
    return key  // 命中去重窗口
  }

  recentWrites.set(key, now)
  // 清理过期条目
  for (const [k, ts] of recentWrites) {
    if (now - ts > DEDUP_WINDOW_MS * 2) recentWrites.delete(k)
  }

  return null
}

// ── 主规则引擎 ──

export function evaluateMemory(content: string, existingTags?: string[]): RuleResult {
  // 1. 去重检查
  const dedupKey = checkDedup(content)
  if (dedupKey) {
    return {
      category: '其他',
      importance: 0,
      tags: [],
      dedupKey,
      reason: '去重命中：相同内容5分钟内已写入',
    }
  }

  // 2. 分类 & 基础重要性
  let category: MemoryCategory = '其他'
  let importance = 1
  let reason = '自动分类'
  const matchedTags: string[] = []

  for (const rule of CATEGORY_RULES) {
    const matched = rule.keywords.some(kw => content.includes(kw))
    if (matched) {
      category = rule.category
      importance = rule.defaultImportance
      matchedTags.push(category)
      reason = `关键词匹配分类: ${category}`
      break
    }
  }

  // 3. 内容长度调整重要性
  if (content.length > 100) importance = Math.min(5, importance + 1)
  if (content.length > 300) importance = Math.min(5, importance + 1)
  if (content.length < 20) importance = Math.max(1, importance - 1)

  // 4. 特殊标记提权
  if (content.includes('!') || content.includes('！') || content.includes('重要')) {
    importance = Math.min(5, importance + 1)
    if (!matchedTags.includes('重要')) matchedTags.push('重要')
  }

  // 5. 合并已有标签
  const allTags = [...new Set([...matchedTags, ...(existingTags ?? [])])]

  return {
    category,
    importance,
    tags: allTags,
    reason: `${reason} | 长度=${content.length}字, 重要性=${importance}`,
  }
}

/** 批量评估（用于对话摘要等场景） */
export function evaluateBatch(items: Array<{ content: string; tags?: string[] }>): RuleResult[] {
  return items.map(item => evaluateMemory(item.content, item.tags))
}
