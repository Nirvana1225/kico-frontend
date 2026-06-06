import { useState } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import type { PersonaProfile, PersonaCard } from '../types'
import { createPersonaCard, getActivePersona } from '../storage/personaProfile'

interface Props {
  profile: PersonaProfile
  onChange: (p: PersonaProfile) => void
  onClose: () => void
}

export function PersonaCorePage({ profile, onChange, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const active = getActivePersona(profile)

  const updatePersona = (id: string, updates: Partial<PersonaCard>) => {
    onChange({
      ...profile,
      personas: profile.personas.map(p => p.id === id ? { ...p, ...updates } : p),
    })
  }

  const addPersona = () => {
    const card = createPersonaCard({ name: '新人格' })
    onChange({ ...profile, personas: [...profile.personas, card] })
    setEditingId(card.id)
  }

  const deletePersona = (id: string) => {
    if (profile.personas.length <= 1) return
    const filtered = profile.personas.filter(p => p.id !== id)
    onChange({
      ...profile,
      activePersonaId: profile.activePersonaId === id ? filtered[0].id : profile.activePersonaId,
      personas: filtered,
    })
  }

  return (
    <div className="page-view">
      <div className="page-header">
        <button className="icon-btn" onClick={onClose}><ArrowLeft size={18} /></button>
        <span>🧠 人格核</span>
        <button className="text-btn" onClick={addPersona} style={{ marginLeft: 'auto' }}>
          <Plus size={16} /> 新建
        </button>
      </div>

      <div className="page-body">
        {/* 用户名称 */}
        <div className="settings-group">
          <label className="settings-label">用户名称</label>
          <input
            className="settings-input"
            value={profile.userName}
            onChange={e => onChange({ ...profile, userName: e.target.value })}
          />
        </div>

        {/* 人格列表 */}
        <div className="settings-group">
          <label className="settings-label">人格卡片</label>
          {profile.personas.map(p => (
            <div key={p.id} className="persona-card-compact">
              <div className="persona-card-header">
                <div
                  className="persona-indicator"
                  style={{ background: p.id === profile.activePersonaId ? 'var(--accent)' : 'var(--bg-tertiary)' }}
                />
                <div style={{ flex: 1 }}>
                  {editingId === p.id ? (
                    <input
                      className="settings-input"
                      value={p.name}
                      onChange={e => updatePersona(p.id, { name: e.target.value })}
                    />
                  ) : (
                    <span className="persona-name">{p.name}</span>
                  )}
                  <span className="persona-badge">{p.id === profile.activePersonaId ? '当前' : '点击激活'}</span>
                </div>
                <button className="icon-btn-sm" onClick={() => setEditingId(editingId === p.id ? null : p.id)}>
                  {editingId === p.id ? '完成' : '编辑'}
                </button>
                <button className="icon-btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deletePersona(p.id)}>
                  <Trash2 size={14} />
                </button>
              </div>

              {editingId === p.id && (
                <div className="persona-edit-form">
                  <div className="settings-group">
                    <label className="settings-label">简介</label>
                    <textarea
                      className="settings-textarea"
                      value={p.description}
                      onChange={e => updatePersona(p.id, { description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="settings-group">
                    <label className="settings-label">系统提示词</label>
                    <textarea
                      className="settings-textarea"
                      value={p.systemPrompt}
                      onChange={e => updatePersona(p.id, { systemPrompt: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <div className="settings-row">
                    <div className="settings-group">
                      <label className="settings-label">温度 ({p.temperature})</label>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.01}
                        value={p.temperature}
                        onChange={e => updatePersona(p.id, { temperature: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="settings-group">
                      <label className="settings-label">上下文深度 ({p.contextDepth})</label>
                      <input
                        type="range"
                        min={0}
                        max={50}
                        value={p.contextDepth}
                        onChange={e => updatePersona(p.id, { contextDepth: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={p.allowMemory}
                      onChange={e => updatePersona(p.id, { allowMemory: e.target.checked })}
                    />
                    启用记忆
                  </label>
                </div>
              )}

              {editingId !== p.id && (
                <div className="persona-card-actions">
                  {p.id !== profile.activePersonaId && (
                    <button
                      className="text-btn"
                      onClick={() => onChange({ ...profile, activePersonaId: p.id })}
                    >
                      设当前
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}