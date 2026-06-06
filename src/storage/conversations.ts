/* ===== 对话记录持久化（localStorage） ===== */

import type { ConversationMessage, ConversationRecord } from '../types'

const STORAGE_KEY = 'kico_conversations_v1'
const MAX_RECORDS = 120

function now(): string {
  return new Date().toISOString()
}

function createId(prefix = 'conv'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function readRecords(): ConversationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRecords(records: ConversationRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)))
}

/** 列出所有对话，按更新时间倒序 */
export function listConversations(): ConversationRecord[] {
  return readRecords().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** 按 ID 获取单个对话 */
export function getConversation(id: string): ConversationRecord | undefined {
  return readRecords().find(c => c.id === id)
}

/** 创建新对话，返回创建后的记录 */
export function createConversation(title = '新的对话'): ConversationRecord {
  const record: ConversationRecord = {
    id: createId(),
    title,
    createdAt: now(),
    updatedAt: now(),
    messages: [],
  }
  const all = readRecords()
  all.unshift(record)
  writeRecords(all)
  return record
}

/** 删除对话 */
export function deleteConversation(id: string) {
  const all = readRecords().filter(c => c.id !== id)
  writeRecords(all)
}

/** 重命名对话 */
export function renameConversation(id: string, title: string) {
  const all = readRecords()
  const found = all.find(c => c.id === id)
  if (found) {
    found.title = title
    found.updatedAt = now()
    writeRecords(all)
  }
}

/** 追加消息到对话 */
export function appendConversationMessages(id: string, messages: ConversationMessage[]) {
  const all = readRecords()
  const found = all.find(c => c.id === id)
  if (!found) return

  // 用 Map 去重，以 id 为 key
  const existingMap = new Map<string, ConversationMessage>()
  for (const msg of found.messages) existingMap.set(msg.id, msg)
  for (const msg of messages) existingMap.set(msg.id, msg)

  found.messages = Array.from(existingMap.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
  found.updatedAt = now()
  // 自动根据首条用户消息更新标题
  const firstUserMsg = found.messages.find(m => m.role === 'user')
  if (firstUserMsg && found.title === '新的对话') {
    found.title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '…' : '')
  }
  writeRecords(all)
}

/** 替换整个对话的消息列表（用于恢复） */
export function replaceConversationMessages(id: string, messages: ConversationMessage[]) {
  const all = readRecords()
  const found = all.find(c => c.id === id)
  if (!found) return
  found.messages = messages
  found.updatedAt = now()
  writeRecords(all)
}
