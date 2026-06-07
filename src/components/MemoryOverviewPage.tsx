/* ===== 记忆全览 ===== */

import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, ChevronLeft, ChevronRight, Clock, X, Tag, Calendar, Star } from 'lucide-react'
import type { MemorySnippet } from '../types'

const GATEWAY_URL = 'https://mr-blinds-hose.zeabur.app'

const PAGE_SIZE = 20

interface AgentTaskStatus {
  [taskId: string]: { last?: number; ago_seconds?: number; interval?: number } | unknown
}

const TASK_LABELS: Record<string, string> = {
  heartbeat: '心跳',
  tide: '潮汐',
  diary: '日记',
}

interface MemoryDetail {
  id: string
  content: string
  category: string
  importance: number
  mem_type: string
  tags: string
  created_at: string
  updated_at?: string
}

function ago(ts?: number): string {
  if (!ts) return '—'
  const sec = Math.floor((Date.now() / 1000) - ts)
  if (sec < 60) return `${sec}秒前`
  if (sec < 3600) return `${Math.floor(sec / 60)}分钟前`
  return `${Math.floor(sec / 3600)}小时前`
}

export function MemoryOverviewPage({ onClose }: { onClose: () => void }) {
  const [memories, setMemories] = useState<MemorySnippet[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [agentStatus, setAgentStatus] = useState<AgentTaskStatus | null>(null)

  const [total, setTotal] = useState(0)
  const [detail, setDetail] = useState<MemoryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const openDetail = async (memId: string) => {
    if (!memId || memId.startsWith('mem-')) return
    setDetailLoading(true)
    try {
      const res = await fetch(`${GATEWAY_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 'mem-detail',
          method: 'tools/call',
          params: { name: 'get_memory', arguments: { memory_id: memId } },
        }),
      })
      const data = await res.json()
      const r = data?.result
      if (r && !r.error) {
        setDetail({
          id: r.id,
          content: r.content,
          category: r.category || '—',
          importance: r.importance ?? 0,
          mem_type: r.mem_type || '—',
          tags: typeof r.tags === 'string' ? r.tags : JSON.stringify(r.tags ?? []),
          created_at: r.created_at || '—',
          updated_at: r.updated_at,
        })
      } else {
        setDetail({ id: memId, content: '⚠️ 无法加载记忆详情', category: '', importance: 0, mem_type: '', tags: '', created_at: '' })
      }
    } catch {
      setDetail({ id: memId, content: '⚠️ 请求失败', category: '', importance: 0, mem_type: '', tags: '', created_at: '' })
    } finally {
      setDetailLoading(false)
    }
  }

  const fetchMemories = useCallback(async (keyword: string, pageNum: number = 0) => {
    setLoading(true)
    try {
      const method = 'search_memories'  // MCP中没有list_memories，统一用search
      // 搜索：一次拉100条，前端分页
      const res = await fetch(`${GATEWAY_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 'mem-overview',
          method: 'tools/call',
          params: { name: method, arguments: { keyword: keyword.trim() || '*', limit: 100 } },
        }),
      })
      const data = await res.json()
      const result = data?.result ?? []
      const rawList = Array.isArray(result) ? result : []
      setTotal(rawList.length)
      setMemories(rawList.map((r: Record<string, unknown>, i: number) => ({
        id: (r.id as string) || `mem-${i}`,
        title: (r.category as string) || '记忆片段',
        text: (r.content as string) || (r.text as string) || '',
        score: r.importance ? (r.importance as number) / 5 : ((r.score as number) ?? 0),
        source: r.source as string || 'ombrebrain',
      })))
    } catch {
      setMemories([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAgentStatus = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/v1/agent-status`)
      if (res.ok) setAgentStatus(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchMemories('', 0) }, [fetchMemories])
  useEffect(() => {
    fetchAgentStatus()
    const timer = setInterval(fetchAgentStatus, 30000)
    return () => clearInterval(timer)
  }, [fetchAgentStatus])

  // 搜索
  const handleSearch = () => {
    setPage(0)
    fetchMemories(searchText.trim(), 0)
  }

  // 翻页
  const goToPage = (newPage: number) => {
    setPage(newPage)
    fetchMemories(searchText.trim(), newPage)
  }

  // 分页数据（搜索模式用内存切片，全览模式由后端返回当前页数据）
  const isSearchMode = searchText.trim().length > 0
  const totalPages = isSearchMode
    ? Math.ceil(memories.length / PAGE_SIZE)
    : Math.ceil(total / PAGE_SIZE)
  const pageMemories = isSearchMode
    ? memories.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : memories

  return (
    <div className="page-view">
      <div className="page-header">
        <button className="icon-btn" onClick={onClose}><ChevronLeft size={18} /></button>
        <span>📋 记忆全览</span>
        <button className="icon-btn" onClick={() => fetchMemories(searchText.trim())} title="刷新" style={{ marginLeft: 'auto' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="auto-panel-content">
        {/* 自动化实时状态卡片 */}
        <div className="auto-section" style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
            <Clock size={14} />
            <span style={{ fontWeight: 500 }}>自动化状态</span>
            {agentStatus && Object.keys(agentStatus).length > 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                {Object.entries(agentStatus).map(([id, val]) => {
                  const v = val as { last?: number }
                  return `${TASK_LABELS[id] || id}: ${ago(v?.last)}`
                }).join(' | ')}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 'auto' }}>加载中...</span>
            )}
          </div>
        </div>

        {/* 搜索栏 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="settings-input"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索记忆关键词..."
          />
          <button className="send-btn" onClick={handleSearch} style={{ padding: '8px 14px' }}>
            <Search size={14} />
          </button>
        </div>

        {/* 记忆列表 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p className="empty-hint">加载中...</p>
          ) : pageMemories.length === 0 ? (
            <p className="empty-hint">暂无记忆数据</p>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
                共 {isSearchMode ? memories.length : total} 条 · 第 {page + 1}/{totalPages || 1} 页
              </div>
              <div className="memory-list">
                {pageMemories.map(mem => (
                  <div key={mem.id} className="memory-item" style={{ cursor: 'pointer' }} onClick={() => openDetail(mem.id)}>
                    <div className="memory-item-title">{mem.title}</div>
                    <div className="memory-item-text">{mem.text}</div>
                    <div className="memory-item-score">
                      {(mem.score ?? 0) > 0 && `重要度 ${Math.round((mem.score ?? 0) * 100)}%`}
                      {mem.source && ` · ${mem.source}`}
                    </div>
                  </div>
                ))}
              </div>

              {/* 翻页 */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                  <button className="icon-btn" onClick={() => goToPage(page - 1)} disabled={page === 0}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{page + 1} / {totalPages}</span>
                  <button className="icon-btn" onClick={() => goToPage(page + 1)} disabled={page >= totalPages - 1}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 记忆详情弹窗 */}
      {(detail || detailLoading) && (
        <div className="modal-overlay" onClick={() => { setDetail(null); setDetailLoading(false) }}>
          <div className="modal-content memory-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 500 }}>
                {detail?.category ? `📂 ${detail.category}` : '记忆详情'}
              </span>
              <button className="icon-btn" onClick={() => { setDetail(null); setDetailLoading(false) }}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {detailLoading ? (
                <p className="empty-hint">加载中...</p>
              ) : detail ? (
                <>
                  <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 16 }}>
                    {detail.content}
                  </div>
                  <div className="memory-detail-meta">
                    {detail.importance > 0 && (
                      <span className="memory-detail-meta-item">
                        <Star size={12} /> 重要度 {detail.importance}/5
                      </span>
                    )}
                    {detail.mem_type && detail.mem_type !== '—' && (
                      <span className="memory-detail-meta-item">
                        <Tag size={12} /> {detail.mem_type}
                      </span>
                    )}
                    {detail.created_at && detail.created_at !== '—' && (
                      <span className="memory-detail-meta-item">
                        <Calendar size={12} /> {new Date(detail.created_at).toLocaleString('zh-CN')}
                      </span>
                    )}
                    {detail.tags && detail.tags !== '[]' && detail.tags !== '—' && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(JSON.parse(typeof detail.tags === 'string' ? detail.tags : '[]') as string[]).map((tag: string, i: number) => (
                          <span key={i} className="tag-badge">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}