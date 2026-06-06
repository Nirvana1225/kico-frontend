import { ArrowLeft } from 'lucide-react'
import type { UplinkSettings, PersonaProfile, ModelProvider } from '../types'
import { PROVIDER_LABELS, MODEL_PRESETS } from '../settings/uplinkSettings'

interface Props {
  settings: UplinkSettings
  onChange: (s: UplinkSettings) => void
  personaProfile: PersonaProfile
  onPersonaChange: (p: PersonaProfile) => void
  onClose: () => void
}

const PROVIDERS: ModelProvider[] = ['openrouter', 'claude', 'gemini', 'glm', 'deepseek', 'gemai']

export function SettingsPage({ settings, onChange, personaProfile, onPersonaChange, onClose }: Props) {
  const updateProfile = (provider: ModelProvider, updates: Partial<typeof settings.profiles[ModelProvider]>) => {
    onChange({
      ...settings,
      profiles: {
        ...settings.profiles,
        [provider]: { ...settings.profiles[provider], ...updates },
      },
    })
  }

  return (
    <div className="page-view">
      <div className="page-header">
        <button className="icon-btn" onClick={onClose}><ArrowLeft size={18} /></button>
        <span>⚙️ 设置</span>
      </div>

      <div className="page-body">
        {/* 供应商配置 */}
        {PROVIDERS.map(provider => (
          <div key={provider} className="settings-card">
            <div className="settings-card-title">
              {PROVIDER_LABELS[provider]}
              <span className={`provider-badge ${settings.activeProvider === provider ? 'active' : ''}`}>
                {settings.activeProvider === provider ? '当前' : ''}
              </span>
            </div>

            <div className="settings-group">
              <label className="settings-label">API Base URL</label>
              <input
                className="settings-input"
                value={settings.profiles[provider].baseUrl}
                onChange={e => updateProfile(provider, { baseUrl: e.target.value })}
              />
            </div>

            <div className="settings-group">
              <label className="settings-label">API Key</label>
              <input
                className="settings-input"
                type="password"
                value={settings.profiles[provider].apiKey}
                onChange={e => updateProfile(provider, { apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>

            <div className="settings-group">
              <label className="settings-label">模型</label>
              <select
                className="settings-input"
                value={settings.profiles[provider].model}
                onChange={e => updateProfile(provider, { model: e.target.value })}
              >
                <option value="">自定义输入</option>
                {(MODEL_PRESETS[provider] || []).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {settings.activeProvider !== provider && (
              <button
                className="text-btn"
                onClick={() => onChange({ ...settings, activeProvider: provider })}
              >
                切换至此供应商
              </button>
            )}
          </div>
        ))}

        {/* 识图模型（观影陪看专用） */}
        <div className="settings-card">
          <div className="settings-card-title">👁️ 识图模型</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            观影陪看时自动切换至此模型。为空时使用主模型。
          </p>
          <div className="settings-group">
            <label className="settings-label">供应商</label>
            <select
              className="settings-input"
              value={settings.visionProvider || ''}
              onChange={e => {
                const provider = e.target.value as ModelProvider | ''
                onChange({
                  ...settings,
                  visionProvider: provider || undefined,
                })
              }}
            >
              <option value="">不使用独立识图模型</option>
              {PROVIDERS.map(p => (
                <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
              ))}
            </select>
          </div>
          {settings.visionProvider && (
            <>
              <div className="settings-group">
                <label className="settings-label">API Key</label>
                <input
                  className="settings-input"
                  type="password"
                  value={settings.visionProfile?.apiKey || ''}
                  onChange={e => onChange({
                    ...settings,
                    visionProfile: { ...(settings.visionProfile || { apiKey: '', baseUrl: '', model: '' }), apiKey: e.target.value },
                  })}
                  placeholder="sk-..."
                />
              </div>
              <div className="settings-group">
                <label className="settings-label">Base URL</label>
                <input
                  className="settings-input"
                  value={settings.visionProfile?.baseUrl || settings.profiles[settings.visionProvider]?.baseUrl || ''}
                  onChange={e => onChange({
                    ...settings,
                    visionProfile: { ...(settings.visionProfile || { apiKey: '', baseUrl: '', model: '' }), baseUrl: e.target.value },
                  })}
                  placeholder={settings.profiles[settings.visionProvider]?.baseUrl || ''}
                />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>为空时使用该供应商的默认地址</p>
              </div>
              <div className="settings-group">
                <label className="settings-label">模型</label>
                <input
                  className="settings-input"
                  value={settings.visionProfile?.model || ''}
                  onChange={e => onChange({
                    ...settings,
                    visionProfile: { ...(settings.visionProfile || { apiKey: '', baseUrl: '', model: '' }), model: e.target.value },
                  })}
                  placeholder="eg. google/gemini-3-flash-preview"
                />
              </div>
            </>
          )}
        </div>

        {/* 回复行为 */}
        <div className="settings-card">
          <div className="settings-card-title">💬 回复行为</div>
          <div className="settings-row">
            <div className="settings-group">
              <label className="settings-label">输出模式</label>
              <select
                className="settings-input"
                value={settings.stream ? 'stream' : settings.streamSplit ? 'split' : 'full'}
                onChange={e => {
                  const v = e.target.value
                  onChange({
                    ...settings,
                    stream: v === 'stream',
                    streamSplit: v === 'split',
                  })
                }}
              >
                <option value="split">分句发送（推荐✨）</option>
                <option value="full">一次性发完</option>
                <option value="stream">逐字流式</option>
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {settings.stream ? '像打字一样逐字输出' : settings.streamSplit ? '拿到完整回复后按句分段蹦' : '完整一条一次性显示'}
              </p>
            </div>
            <div className="settings-group">
              <label className="settings-label">禁止动作描写</label>
              <select
                className="settings-input"
                value={settings.noActions ? 'true' : 'false'}
                onChange={e => onChange({ ...settings, noActions: e.target.value === 'true' })}
              >
                <option value="false">允许（默认）</option>
                <option value="true">禁止</option>
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>AI只输出纯对话，不含*动作*或描述</p>
            </div>
          </div>
        </div>

        {/* 延迟回复 */}
        <div className="settings-card">
          <div className="settings-card-title">⏳ 延迟回复</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            开启后AI不会立刻回复每一条消息，而是等你停止输入一段时间后一次性回复所有内容。
          </p>
          <div className="settings-row">
            <div className="settings-group">
              <label className="settings-label">开启</label>
              <select
                className="settings-input"
                value={settings.delayedReply ? 'true' : 'false'}
                onChange={e => onChange({ ...settings, delayedReply: e.target.value === 'true' })}
              >
                <option value="false">关闭（立即回复）</option>
                <option value="true">开启</option>
              </select>
            </div>
            <div className="settings-group">
              <label className="settings-label">等待时长</label>
              <select
                className="settings-input"
                value={settings.delayMs}
                onChange={e => onChange({ ...settings, delayMs: Number(e.target.value) })}
              >
                <option value={5000}>5 秒</option>
                <option value={10000}>10 秒</option>
                <option value={15000}>15 秒</option>
                <option value={20000}>20 秒</option>
                <option value={30000}>30 秒</option>
                <option value={60000}>1 分钟</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            发送消息后会出现「结束等待」按钮，点它就能立刻让AI回复。
          </p>
        </div>

        {/* 外观 */}
        <div className="settings-card">
          <div className="settings-card-title">外观</div>
          <div className="settings-row">
            <div className="settings-group">
              <label className="settings-label">主题</label>
              <select
                className="settings-input"
                value={settings.visual.theme}
                onChange={e => onChange({
                  ...settings,
                  visual: { ...settings.visual, theme: e.target.value as 'black-gold' | 'white-gold' | 'pink-mocha' },
                })}
              >
                <option value="black-gold">黑金</option>
                <option value="white-gold">白金</option>
                <option value="pink-mocha">粉摩卡</option>
              </select>
            </div>
            <div className="settings-group">
              <label className="settings-label">字号</label>
              <select
                className="settings-input"
                value={settings.visual.fontSize}
                onChange={e => onChange({
                  ...settings,
                  visual: { ...settings.visual, fontSize: e.target.value as 'small' | 'standard' | 'large' },
                })}
              >
                <option value="small">小</option>
                <option value="standard">标准</option>
                <option value="large">大</option>
              </select>
            </div>
          </div>
        </div>

        {/* 用户设置 */}
        <div className="settings-card">
          <div className="settings-card-title">用户</div>
          <div className="settings-group">
            <label className="settings-label">显示名称</label>
            <input
              className="settings-input"
              value={personaProfile.userName}
              onChange={e => onPersonaChange({ ...personaProfile, userName: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}