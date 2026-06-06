/* ===== 情绪和弦 ===== */

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, Heart } from 'lucide-react'

const GATEWAY_URL = 'https://mr-blinds-hose.zeabur.app'

interface EcgRecord {
  date: string
  user_score: number
  user_mood: string
  ai_score: number
  ai_mood: string
}

const chordMap: Record<string, string> = {
  happy: 'Fmaj9',
  sad: 'Am9',
  anxious: 'Dm7b5',
  calm: 'Cmaj7',
  excited: 'Gmaj7',
  tired: 'Em9',
  angry: 'Bdim7',
  love: 'Amaj9',
  peaceful: 'Fmaj7',
  neutral: 'C6',
  nostalgic: 'F6/9',
  hopeful: 'Gsus2',
  restless: 'Dm9',
  grateful: 'Amaj7',
  proud: 'Ebmaj7',
}

function scoreToChord(score: number, mood: string): string {
  if (mood && chordMap[mood.toLowerCase()]) return chordMap[mood.toLowerCase()]
  if (score >= 5) return 'Gmaj7'
  if (score >= 4) return 'Fmaj7'
  if (score >= 3) return 'Cmaj7'
  if (score >= 2) return 'Am9'
  return 'Dm7b5'
}

function chordColor(chord: string): string {
  const majors = ['maj7', 'maj9', '6', 'sus2']
  if (majors.some(s => chord.includes(s))) return '#4ade80'
  if (chord.includes('m')) return '#f87171'
  if (chord.includes('dim')) return '#a78bfa'
  return '#fbbf24'
}

export function MoodPage({ onClose }: { onClose: () => void }) {
  const [records, setRecords] = useState<EcgRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEcg = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${GATEWAY_URL}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 'mood',
          method: 'tools/call',
          params: { name: 'get_ecg', arguments: { days: 14 } },
        }),
      })
      const data = await res.json()
      const result = data?.result
      if (Array.isArray(result)) setRecords(result)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchEcg() }, [fetchEcg])

  return (
    <div className="page-view">
      <div className="page-header">
        <button className="icon-btn" onClick={onClose}><ChevronLeft size={18} /></button>
        <span>🎵 情绪和弦</span>
        <button className="icon-btn" onClick={fetchEcg} title="刷新" style={{ marginLeft: 'auto' }}>
          <Heart size={14} />
        </button>
      </div>

      <div className="auto-panel-content">
        <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12, padding: '0 4px' }}>
          每日情绪映射为和弦——小鸟儿 · 瞎子
        </p>

        {loading ? (
          <p className="empty-hint">加载中...</p>
        ) : records.length === 0 ? (
          <p className="empty-hint">暂无情绪记录</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {records.map(r => {
              const userChord = scoreToChord(r.user_score, r.user_mood)
              const aiChord = scoreToChord(r.ai_score, r.ai_mood)
              const userC = chordColor(userChord)
              const aiC = chordColor(aiChord)

              return (
                <div key={r.date} className="auto-task-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>
                    {r.date}
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
                    {/* 用户情绪 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        🐦 小鸟儿 · {r.user_mood || '—'}
                      </span>
                      <div style={{
                        background: 'var(--bg-card-hover)',
                        borderRadius: 8, padding: '6px 10px',
                        border: `2px solid ${userC}30`,
                        fontFamily: 'monospace', fontSize: 14, fontWeight: 600,
                        color: userC,
                      }}>
                        {userChord}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        评分 {r.user_score}/5
                      </div>
                    </div>

                    {/* 瞎子情绪 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        🕶️ 瞎子 · {r.ai_mood || '—'}
                      </span>
                      <div style={{
                        background: 'var(--bg-card-hover)',
                        borderRadius: 8, padding: '6px 10px',
                        border: `2px solid ${aiC}30`,
                        fontFamily: 'monospace', fontSize: 14, fontWeight: 600,
                        color: aiC,
                      }}>
                        {aiChord}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        评分 {r.ai_score}/5
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
