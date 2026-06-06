import type { MemorySnippet, MemoryAdapter, LLMAdapter, CompanionRequest, CompanionResponse, PersonaAdapter } from '../types'
import { getActiveProfile } from '../settings/uplinkSettings'
import type { UplinkSettings } from '../types'
import { queryMemoryByText } from './ombreMemory'

/* ===== OmbreBrain 记忆适配器 ===== */
export function createOmbreMemoryAdapter(isEnabled: () => boolean): MemoryAdapter {
  return {
    async retrieveRelevant(query: string, limit = 4): Promise<MemorySnippet[]> {
      if (!isEnabled()) return []
      try {
        return await queryMemoryByText(query, limit)
      } catch {
        return []
      }
    },
  }
}

/* ===== 默认人格适配器 ===== */
export function createPersonaAdapter(getPersona: () => { name: string; systemPrompt: string; description: string }, getUserName: () => string): PersonaAdapter {
  return {
    async getPersonaCore() {
      const p = getPersona()
      return [
        `Companion name: ${p.name}`,
        `User name: ${getUserName()}`,
        p.description ? `Description: ${p.description}` : '',
        '',
        p.systemPrompt,
      ].filter(Boolean).join('\n')
    },
    async getUserContext() {
      return `User name: ${getUserName()}`
    },
  }
}

/* ===== OmbreBrain LLM 适配器 ===== */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** 将文本切成 1~2 句一组的分块用于分句发送 */
function splitIntoChunks(text: string): string[] {
  const sentences = text.split(/(?<=[。！？.!?\n])/).map(s => s.trim()).filter(s => s.length > 0)
  const chunks: string[] = []
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(''))
  }
  return chunks.length > 0 ? chunks : [text]
}

export function createOmbreLLMAdapter(getSettings: () => UplinkSettings): LLMAdapter {
  return {
    async complete(request: CompanionRequest): Promise<CompanionResponse> {
      const settings = getSettings()
      const isVisionMode = request.mode === 'cinema' && settings.visionProfile?.apiKey

      // 选择模型：观影/识图模式走独立识图模型，否则走主模型
      const profile = isVisionMode && settings.visionProfile
        ? { ...settings.visionProfile, baseUrl: settings.visionProfile.baseUrl || (settings.profiles[settings.visionProvider || 'openrouter']?.baseUrl || '') }
        : getActiveProfile(settings)

      if (!profile.apiKey.trim()) {
        throw new Error(isVisionMode ? '请先在设置里配置识图模型的 API Key' : '请先在设置里填写 API Key')
      }

      const prompt = buildPrompt(request, settings.noActions)
      const endpoint = `${profile.baseUrl.replace(/\/+$/, '')}/chat/completions`

      const body: Record<string, unknown> = {
        model: profile.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: settings.temperature,
        max_tokens: settings.contextLoad.maxOutputTokens,
        stream: settings.stream ?? false,
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${profile.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`API Error ${response.status}: ${text}`)
      }

      let fullText: string
      if (settings.stream) {
        fullText = await readStream(response, request.onStreamUpdate)
      } else {
        const data = await response.json()
        fullText = data?.choices?.[0]?.message?.content?.trim() || ''

        if (settings.streamSplit && fullText) {
          // 分句发送：切成自然段，一条一条蹦
          const chunks = splitIntoChunks(fullText)
          let accumulated = ''
          for (let i = 0; i < chunks.length; i++) {
            accumulated += chunks[i]
            request.onStreamUpdate?.(accumulated)
            if (i < chunks.length - 1) {
              await sleep(350)
            }
          }
        } else {
          request.onStreamUpdate?.(fullText)
        }
      }

      return {
        text: fullText || '模型返回为空',
        promptPreview: prompt.slice(0, 500),
        modelUsed: profile.model,
        tokenCount: Math.ceil(fullText.length / 3),
      }
    },
  }
}

/* ===== 流式读取 ===== */
async function readStream(response: Response, onChunk?: (text: string) => void): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    const data = await response.json()
    return data?.choices?.[0]?.message?.content || ''
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.replace(/^data:\s*/, '')
      if (!data || data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed?.choices?.[0]?.delta?.content ?? ''
        if (content) {
          fullText += content
          onChunk?.(fullText)
        }
      } catch { /* skip partial chunks */ }
    }
  }

  return fullText.trim()
}

/* ===== 提示词构建 ===== */
function buildPrompt(request: CompanionRequest, noActions?: boolean): string {
  const parts: string[] = ['You are an AI companion configured by the user.']

  if (request.personaCore) {
    parts.push('\nPersona core:\n' + request.personaCore)
  }

  if (noActions) {
    parts.push('\n规则：回复时只输出纯对话内容，不要包含任何动作描写、表情描写或叙述性动作描述。')
  }

  if (request.memories?.length) {
    parts.push(
      '\nRelevant memories:\n' +
      request.memories.map(m => `- ${m.title}: ${m.text}`).join('\n')
    )
  }

  if (request.recentMessages?.length) {
    parts.push(
      '\nRecent conversation:\n' +
      request.recentMessages.map(m =>
        `${m.role === 'user' ? 'User' : 'Companion'}: ${m.text}`
      ).join('\n')
    )
  }

  parts.push('\n' + request.userMessage)

  if (request.mode === 'plan') {
    parts.push('\nReturn only one JSON object.')
  }

  if (request.mode === 'cinema' && request.watch?.title) {
    parts.push('\n[电影陪看模式]')
    parts.push(`当前视频: ${request.watch.title}`)
    if (request.watch.currentTime > 0) {
      parts.push(`播放进度: ${Math.floor(request.watch.currentTime / 60)}分${Math.floor(request.watch.currentTime % 60)}秒`)
    }
    if (request.watch.duration > 0) {
      parts.push(`总时长: ${Math.floor(request.watch.duration / 60)}分${Math.floor(request.watch.duration % 60)}秒`)
    }
    parts.push('\n请以陪看聊天的口吻回应，可以吐槽剧情、分析镜头、讨论设定，就像一起看视频的朋友一样。')
  }

  return parts.join('\n')
}