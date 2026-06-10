/* ===== 情绪和弦 ===== */

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, Heart, Sparkles } from 'lucide-react'
import { captureMemory } from '../adapters/memoryAutoCapture'

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

const moodOptions = ['happy','sad','anxious','calm','excited','tired','angry','love','peaceful','neutral','nostalgic','hopeful','grateful','proud']

export function MoodPage({ onClose }: { onClose: () => void }) {
  const [records, setRecords] = useState<EcgRecord[]>([])
  const [loading, setLoading] = useState(true)

  // ── 情绪记录表单 ──
  const [moodValue, setMoodValue] = useState('')
  const [score, setScore] = useState(3)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleMoodSubmit = useCallback(async () => {
    if (!moodValue || saving) return
    setSaving(true)
    try {
      const ok = await captureMemory({
        content: `[情绪记录] 心情:${moodValue} · 评分:${score}/5 · ${note || '无备注'}`,
        source: '情绪',
        existingTags: ['情绪', moodValue],
      })
      setSaved(ok)
      if (ok) {
        // 直接插入一条新记录到列表顶部，情绪和弦立刻生效
        const today = new Date().toISOString().slice(0, 10)
        setRecords(prev => [{
          date: today,
          user_score: score,
          user_mood: moodValue,
          ai_score: 0,
          ai_mood: '',
        }, ...prev.filter(r => r.date !== today)])
        setMoodValue('')
        setScore(3)
        setNote('')
        setTimeout(() => setSaved(false), 3000)
      }
    } finally {
      setSaving(false)
    }
  }, [moodValue, score, note, saving])

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

        {/* 情绪记录表单 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid var(--border-color, #333)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} /> 记录今日情绪
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {moodOptions.slice(0, 8).map(m => (
              <button key={m}
                onClick={() => setMoodValue(m)}
                style={{
                  padding: '4px 12px', borderRadius: 14, border: `1px solid ${moodValue === m ? '#4ade80' : 'var(--border-color,#444)'}`,
                  background: moodValue === m ? '#4ade8020' : 'transparent',
                  color: moodValue === m ? '#4ade80' : 'var(--text-color)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >{m}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12 }}>评分:</span>
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => setScore(s)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: `1px solid ${score >= s ? '#fbbf24' : 'var(--border-color,#444)'}`,
                  background: score >= s ? '#fbbf2430' : 'transparent',
                  color: score >= s ? '#fbbf24' : 'var(--text-dim)',
                  fontSize: 12, cursor: 'pointer',
                }}
              >{s}</button>
            ))}
          </div>
          <input
            type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="想说什么..."
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color,#444)',
              background: 'var(--bg-card-hover)', fontSize: 13, color: 'var(--text-color)', marginBottom: 10, boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleMoodSubmit} disabled={!moodValue || saving}
              className="send-btn" style={{ padding: '6px 18px', fontSize: 13 }}>
              {saving ? '保存中...' : saved ? '✅ 已记录' : '记录情绪'}
            </button>
          </div>
        </div>

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
