/* ===== 自动化控制面板 ===== */

import { useState, useEffect, useCallback } from 'react'
import { Activity, RefreshCw, ExternalLink, Clock, Brain } from 'lucide-react'

const GATEWAY_URL = 'https://mr-blinds-hose.zeabur.app'

interface AutoTask {
  id: string
  label: string
  description: string
  endpoint: string
  icon: string
}

interface AgentStatus {
  [taskId: string]: {
    last?: number
    ago_seconds?: number
    interval?: number
  } | unknown
}

interface DashboardData {
  total_memories?: number
  category_count?: number
  top_category?: string
  latest_at?: string
  totalMemories?: number
  categoryCounts?: Record<string, number>
  recentActivity?: string
}

const AUTO_TASKS: AutoTask[] = [
  { id: 'heartbeat', label: '心跳扫描', description: '自动感知环境状态，30分钟周期', endpoint: '/api/v1/trigger/heartbeat', icon: '💓' },
  { id: 'diary', label: '日记整合', description: '将零散记忆整合为结构化日记', endpoint: '/api/v1/trigger/diary', icon: '📔' },
  { id: 'tide', label: '潮汐摘要', description: '生成周期性记忆潮汐报告', endpoint: '/api/v1/trigger/tide', icon: '🌊' },
  { id: 'chat-summarize', label: '对话摘要', description: '汇总近期对话关键信息', endpoint: '/api/v1/trigger/chat-summarize', icon: '💬' },
  { id: 'cleanup', label: '记忆清理', description: '清理冗余低质记忆碎片', endpoint: '/api/v1/trigger/cleanup', icon: '🧹' },
]

function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60) return `${diff}秒前`
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    return d.toLocaleDateString()
  } catch {
    return iso
  }
}

export function AutoPanel({ onClose }: { onClose: () => void }) {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerMsg, setTriggerMsg] = useState<{ task: string; ok: boolean } | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, dashRes] = await Promise.all([
        fetch(`${GATEWAY_URL}/api/v1/agent-status`),
        fetch(`${GATEWAY_URL}/api/v1/dashboard`),
      ])
      if (statusRes.ok) setAgentStatus(await statusRes.json())
      if (dashRes.ok) setDashboard(await dashRes.json())
    } catch (err) {
      console.warn('Failed to fetch auto status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // 30秒自动轮询 + 首次立即加载 + 失败重试
  useEffect(() => {
    let retries = 0
    const MAX_RETRIES = 3

    const doFetch = () => {
      fetchStatus().catch(() => {
        if (retries < MAX_RETRIES) {
          retries++
          setTimeout(doFetch, 2000 * retries)
        }
      })
    }

    // 首次立即加载
    doFetch()

    // 30秒轮询
    const timer = setInterval(doFetch, 30000)
    return () => clearInterval(timer)
  }, [fetchStatus])

  const triggerTask = async (task: AutoTask) => {
    setTriggering(task.id)
    setTriggerMsg(null)
    try {
      const res = await fetch(`${GATEWAY_URL}${task.endpoint}`, { method: 'POST' })
      const data = await res.json()
      setTriggerMsg({ task: task.label, ok: res.ok })
      setTimeout(() => setTriggerMsg(null), 3000)
      // 刷新状态
      fetchStatus()
    } catch {
      setTriggerMsg({ task: task.label, ok: false })
      setTimeout(() => setTriggerMsg(null), 3000)
    } finally {
      setTriggering(null)
    }
  }

  const getTaskTime = (taskId: string): string | undefined => {
    if (!agentStatus) return undefined
    const task = (agentStatus as Record<string, unknown>)[taskId]
    if (!task || typeof task !== 'object') return undefined
    const taskObj = task as { last?: number }
    if (!taskObj.last) return undefined
    // 后端返回的是秒级时间戳，转ISO字符串
    return new Date(taskObj.last * 1000).toISOString()
  }

  return (
    <div className="page-view">
      <div className="page-header">
        <button className="icon-btn" onClick={onClose}><Activity size={18} /></button>
        <span>⚙️ 自动化控制</span>
        <button className="icon-btn" onClick={fetchStatus} title="刷新" style={{ marginLeft: 'auto' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="auto-panel-content">
        {/* 记忆库概览 */}
        <div className="auto-section">
          <h3 className="auto-section-title"><Brain size={16} /> 记忆库概览</h3>
          <div className="auto-stats-grid">
            <div className="auto-stat-card">
              <span className="auto-stat-value">{(dashboard?.total_memories ?? dashboard?.totalMemories ?? '?')}</span>
          <span className="auto-stat-label">总记忆数</span>
        </div>
        <div className="auto-stat-card">
          <span className="auto-stat-value">{dashboard?.category_count ?? (dashboard?.categoryCounts ? Object.keys(dashboard.categoryCounts).length : '?')}</span>
          <span className="auto-stat-label">分类数</span>
        </div>
        <div className="auto-stat-card">
          <span className="auto-stat-value" style={{ fontSize: 11 }}>{(dashboard?.latest_at ?? dashboard?.recentActivity) ? formatTime(dashboard.latest_at ?? dashboard!.recentActivity!) : '—'}</span>
              <span className="auto-stat-label">最近活动</span>
            </div>
          </div>
        </div>

        {/* 自动化任务列表 */}
        <div className="auto-section">
          <h3 className="auto-section-title"><Clock size={16} /> 自动化任务</h3>
          {loading ? (
            <p className="auto-loading">加载中...</p>
          ) : (
            <div className="auto-task-list">
              {AUTO_TASKS.map(task => (
                <div key={task.id} className="auto-task-item">
                  <div className="auto-task-info">
                    <span className="auto-task-icon">{task.icon}</span>
                    <div>
                      <span className="auto-task-label">{task.label}</span>
                      <span className="auto-task-desc">{task.description}</span>
                      <span className="auto-task-time">上次: {formatTime(getTaskTime(task.id))}</span>
                    </div>
                  </div>
                  <button
                    className="auto-trigger-btn"
                    onClick={() => triggerTask(task)}
                    disabled={triggering === task.id}
                  >
                    {triggering === task.id ? '···' : '触发'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {triggerMsg && (
            <div className={`auto-trigger-msg ${triggerMsg.ok ? 'ok' : 'fail'}`}>
              {triggerMsg.ok ? '✅' : '❌'} {triggerMsg.task} {triggerMsg.ok ? '已触发' : '触发失败'}
            </div>
          )}
        </div>

        {/* 网关跳转 */}
        <div className="auto-section" style={{ border: 'none', paddingBottom: 32 }}>
          <a
            href="https://mr-blinds-hose.zeabur.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="auto-gateway-link"
          >
            <ExternalLink size={14} />
            前往网关 · 记忆可视化
          </a>
        </div>
      </div>
    </div>
  )
}