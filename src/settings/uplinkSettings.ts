import type { ModelProvider, ProviderProfile, UplinkSettings, VisualSettings } from '../types'

const STORAGE_KEY = 'kico_ombre_uplink_v1'

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  openrouter: 'OpenRouter',
  claude: 'Claude',
  gemini: 'Gemini',
  glm: 'GLM / 智谱',
  deepseek: 'DeepSeek',
  gemai: '中转站 / Gemai',
}

export const MODEL_PRESETS: Record<ModelProvider, { id: string; name: string }[]> = {
  openrouter: [
    { id: 'openai/gpt-4o-2024-11-20', name: 'GPT-4o' },
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash' },
    { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6' },
  ],
  claude: [
    { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
  ],
  gemini: [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ],
  glm: [
    { id: 'glm-5v-turbo', name: 'GLM-5V-Turbo' },
    { id: 'glm-5', name: 'GLM-5' },
  ],
  deepseek: [
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
    { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
  ],
  gemai: [
    { id: 'gemini-3-flash-preview', name: '[官逆C] gemini-3-flash-preview' },
    { id: 'glm-5', name: '[官逆] glm-5' },
    { id: 'gemini-2.5-flash', name: '[满血A] gemini-2.5-flash' },
    { id: 'gemini-3-flash-preview', name: '[满血A] gemini-3-flash-preview' },
    { id: 'gemini-3.1-flash-lite-preview', name: '[满血A] gemini-3.1-flash-lite-preview' },
    { id: 'gemini-3.1-flash-lite-preview-maxthinking', name: '[满血A] gemini-3.1-flash-lite-preview-maxthinking' },
    { id: 'gemini-3.1-flash-lite-preview-search-maxthinking', name: '[满血A] gemini-3.1-flash-lite-preview-search-maxthinking' },
    { id: 'gemini-2.5-flash', name: '[满血B] gemini-2.5-flash' },
    { id: 'gemini-2.5-flash', name: '[满血C] gemini-2.5-flash' },
    { id: 'gemini-2.5-flash-thinking', name: '[满血C] gemini-2.5-flash-thinking' },
    { id: 'gemini-3-flash-preview', name: '[满血D] gemini-3-flash-preview' },
    { id: 'gemini-3.5-flash', name: '[满血E] gemini-3.5-flash' },
    { id: 'gemini-2.5-pro', name: '[满血F] gemini-2.5-pro' },
    { id: 'gemini-3-flash-preview', name: '[满血F] gemini-3-flash-preview' },
    { id: 'claude-opus-4-6', name: '[特价B] claude-opus-4-6' },
    { id: 'claude-sonnet-4-6', name: '[特价] claude-sonnet-4-6' },
    { id: 'claude-sonnet-4-6-thinking', name: '[特价] claude-sonnet-4-6-thinking' },
    { id: 'gemini-3-flash-preview', name: '[福利] gemini-3-flash-preview' },
    { id: 'gemini-3-flash-preview-thinking', name: '[福利] gemini-3-flash-preview-thinking' },
    { id: 'gemini-3.1-flash-lite-preview', name: '[福利] gemini-3.1-flash-lite-preview' },
    { id: 'gemini-3.5-flash', name: '[福利] gemini-3.5-flash' },
  ],
}

const DEFAULT_PROFILES: Record<ModelProvider, ProviderProfile> = {
  openrouter: { apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-2024-11-20' },
  claude: { apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4.5' },
  gemini: { apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-pro' },
  glm: { apiKey: '', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5v-turbo' },
  deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
  gemai: { apiKey: '', baseUrl: 'https://api2.gemai.cc', model: 'gpt-4o' },
}

const DEFAULT_VISUAL: VisualSettings = {
  theme: 'black-gold',
  fontStyle: 'system',
  fontSize: 'standard',
  showStatusStrip: true,
  showButtonLabels: true,
}

export const DEFAULT_SETTINGS: UplinkSettings = {
  activeProvider: 'openrouter',
  temperature: 0.72,
  stream: false,
  profiles: DEFAULT_PROFILES,
  visionProvider: undefined,
  visionProfile: { apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', model: 'google/gemini-3-flash-preview' },
  noActions: false,
  streamSplit: true,
  delayedReply: false,
  delayMs: 10000,
  contextLoad: {
    maxOutputTokens: 1200,
    shortTermMessageLimit: 15,
    memorySnippetLimit: 4,
    attachScreenshot: false,
  },
  visual: DEFAULT_VISUAL,
}

export function loadUplinkSettings(): UplinkSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    // 合并默认配置，确保新供应商字段不缺
    const mergedProfiles = { ...DEFAULT_PROFILES }
    if (parsed.profiles) {
      for (const key of Object.keys(parsed.profiles)) {
        mergedProfiles[key as ModelProvider] = { ...mergedProfiles[key as ModelProvider], ...parsed.profiles[key] }
      }
    }
    return { ...DEFAULT_SETTINGS, ...parsed, profiles: mergedProfiles }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveUplinkSettings(settings: UplinkSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function getActiveProfile(settings: UplinkSettings): ProviderProfile {
  return settings.profiles[settings.activeProvider]
}