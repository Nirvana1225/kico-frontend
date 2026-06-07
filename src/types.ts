/* ===== 核心类型 ===== */

export type ModelProvider = 'openrouter' | 'claude' | 'gemini' | 'glm' | 'deepseek' | 'gemai'
export type ThemePreset = 'black-gold' | 'white-gold' | 'pink-mocha'
export type AppPage = 'cinema' | 'coread' | 'chat' | 'settings' | 'persona' | 'memory' | 'vector' | 'auto' | 'overview' | 'mood'

/* ===== 字幕 ===== */
export interface SubtitleCue {
  id: string
  start: number
  end: number
  text: string
}

export interface SubtitleWindow {
  active?: SubtitleCue
  previous: SubtitleCue[]
  next: SubtitleCue[]
}

/* ===== 观影记录 ===== */
export interface WatchRecord {
  id: string
  title: string
  sourceType: 'local-file' | 'web-url'
  sourceLabel: string
  currentTime: number
  duration: number
  updatedAt: string
  thumbnailDataUrl?: string
  webUrl?: string
  webPlatform?: 'bilibili'
  subtitleCount?: number
}

export interface WatchContext {
  title: string
  currentTime: number
  duration: number
  sourceType: 'local-file' | 'web-url'
  activeSubtitle?: SubtitleCue
  subtitleWindow: SubtitleWindow
  screenshotDataUrl?: string
}

/* ===== 记忆 ===== */
export interface MemorySnippet {
  id: string
  title: string
  text: string
  score?: number
  source?: string
}

/* ===== 供应商配置 ===== */
export interface ProviderProfile {
  apiKey: string
  baseUrl: string
  model: string
}

export interface ContextLoadSettings {
  maxOutputTokens: number
  shortTermMessageLimit: number
  memorySnippetLimit: number
  attachScreenshot: boolean
}

export interface VisualSettings {
  theme: ThemePreset
  fontStyle: 'system' | 'soft'
  fontSize: 'small' | 'standard' | 'large'
  showStatusStrip: boolean
  showButtonLabels: boolean
}

/* ===== 应用设置 ===== */
export interface UplinkSettings {
  activeProvider: ModelProvider
  temperature: number
  stream: boolean
  profiles: Record<ModelProvider, ProviderProfile>
  visionProvider?: ModelProvider
  visionProfile?: ProviderProfile
  noActions: boolean
  streamSplit: boolean               // 非流式时分句发送
  delayedReply: boolean              // 延迟回复
  delayMs: number                    // 延迟时间(毫秒)
  contextLoad: ContextLoadSettings
  visual: VisualSettings
}

/* ===== 对话 ===== */
export interface ConversationTurn {
  role: 'user' | 'companion'
  text: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'companion'
  text: string
  createdAt: string
  modelUsed?: string
  tokenCount?: number
}

export interface ConversationRecord {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ConversationMessage[]
}

/* ===== 人格 ===== */
export interface PersonaCard {
  id: string
  name: string
  description: string
  systemPrompt: string
  themeColor: string
  temperature: number
  contextDepth: number
  allowMemory: boolean
}

export interface PersonaProfile {
  userName: string
  showAvatars: boolean
  activePersonaId: string
  personas: PersonaCard[]
}

/* ===== 适配器 ===== */
export interface PersonaAdapter {
  getPersonaCore(): Promise<string>
  getUserContext?(): Promise<string>
}

export interface MemoryAdapter {
  retrieveRelevant(query: string, limit?: number): Promise<MemorySnippet[]>
}

export interface CompanionRequest {
  mode?: 'cinema' | 'chat' | 'plan' | 'coread'
  cacheScope?: string
  userMessage: string
  watch: WatchContext
  personaCore: string
  userContext?: string
  memories: MemorySnippet[]
  recentMessages?: ConversationTurn[]
  onStreamUpdate?: (text: string) => void
}

export interface CompanionResponse {
  text: string
  promptPreview?: string
  modelUsed?: string
  tokenCount?: number
}

export interface LLMAdapter {
  complete(request: CompanionRequest): Promise<CompanionResponse>
}

export interface CompanionAdapters {
  persona: PersonaAdapter
  memory: MemoryAdapter
  llm: LLMAdapter
}

/* ===== 观影计划 ===== */
export interface CompanionPlanPoint {
  id: string
  time: number
  subtitle?: string
  companionHint: string
  type?: 'emotion' | 'observe' | 'question' | 'memory'
  priority?: 'high' | 'medium' | 'low'
  delivery?: 'auto' | 'hint' | 'manual'
}