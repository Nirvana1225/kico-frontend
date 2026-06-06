import { ArrowLeft } from 'lucide-react'
import type { UplinkSettings } from '../types'
import { PROVIDER_LABELS } from '../settings/uplinkSettings'

interface Props {
  settings: UplinkSettings
  onChange: (s: UplinkSettings) => void
}

export function VectorLabPage({ settings, onChange }: Props) {
  return (
    <div className="page-view">
      <div className="page-header">
        <span>🎛️ 调音台</span>
      </div>

      <div className="page-body">
        <div className="settings-group">
          <label className="settings-label">模型参数调整</label>

          <div className="settings-card">
            <label className="settings-label">温度 / 创造力 ({settings.temperature})</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={settings.temperature}
              onChange={e => onChange({ ...settings, temperature: parseFloat(e.target.value) })}
            />
            <div className="settings-hint">
              较低值更稳定精确，较高值更有创造力
            </div>
          </div>

          <div className="settings-card">
            <label className="settings-label">最大输出 Tokens ({settings.contextLoad.maxOutputTokens})</label>
            <input
              type="range"
              min={256}
              max={8192}
              step={128}
              value={settings.contextLoad.maxOutputTokens}
              onChange={e => onChange({
                ...settings,
                contextLoad: { ...settings.contextLoad, maxOutputTokens: parseInt(e.target.value) },
              })}
            />
          </div>

          <div className="settings-card">
            <label className="settings-label">短期消息保留 ({settings.contextLoad.shortTermMessageLimit})</label>
            <input
              type="range"
              min={1}
              max={50}
              value={settings.contextLoad.shortTermMessageLimit}
              onChange={e => onChange({
                ...settings,
                contextLoad: { ...settings.contextLoad, shortTermMessageLimit: parseInt(e.target.value) },
              })}
            />
            <div className="settings-hint">
              对话中保留的最近消息条数
            </div>
          </div>

          <div className="settings-card">
            <label className="settings-label">记忆片段数 ({settings.contextLoad.memorySnippetLimit})</label>
            <input
              type="range"
              min={0}
              max={20}
              value={settings.contextLoad.memorySnippetLimit}
              onChange={e => onChange({
                ...settings,
                contextLoad: { ...settings.contextLoad, memorySnippetLimit: parseInt(e.target.value) },
              })}
            />
          </div>

          <div className="settings-card">
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={settings.stream}
                onChange={e => onChange({ ...settings, stream: e.target.checked })}
              />
              流式输出
            </label>
          </div>
        </div>

        <div className="settings-group">
          <label className="settings-label">当前供应商</label>
          <div className="settings-card">
            {PROVIDER_LABELS[settings.activeProvider]}
          </div>
        </div>
      </div>
    </div>
  )
}