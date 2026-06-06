import { useState, useCallback, useRef, useEffect } from 'react'
import { MessageCircle, UserRound, Database, Play, ExternalLink, Send } from 'lucide-react'
import type { CompanionAdapters, ConversationMessage, CompanionRequest, PersonaProfile } from '../types'
import { createConversation, appendConversationMessages, getConversation } from '../storage/conversations'

interface Props {
  adapters: CompanionAdapters
  personaProfile: PersonaProfile
  onOpenChat: () => void
  onOpenChatWithConv: (convId: string) => void
  onOpenPersona: () => void
  onOpenMemory: () => void
}

interface WebFrameSource {
  platform: 'bilibili'
  keyword: string
  url: string
  originalUrl?: string
  embedUrl?: string
  mode?: 'embed' | 'page'
  title: string
}

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim())
}

function buildBilibiliEmbedUrl(rawUrl: string): string | undefined {
  try {
    const parsed = new URL(rawUrl)
    const videoMatch = parsed.pathname.match(/\/video\/(BV[a-zA-Z0-9]+|av\d+)/i)
    if (!videoMatch) return undefined

    const videoId = videoMatch[1]
    const page = parsed.searchParams.get('p') || '1'
    const embed = new URL('https://player.bilibili.com/player.html')
    if (/^BV/i.test(videoId)) {
      embed.searchParams.set('bvid', videoId)
    } else {
      embed.searchParams.set('aid', videoId.replace(/^av/i, ''))
    }
    embed.searchParams.set('page', page)
    embed.searchParams.set('autoplay', '0')
    embed.searchParams.set('danmaku', '0')
    return embed.toString()
  } catch {
    return undefined
  }
}

function createBilibiliFrameSource(keyword: string): WebFrameSource {
  const trimmed = keyword.trim()
  const isUrl = isHttpUrl(trimmed)
  const embedUrl = isUrl ? buildBilibiliEmbedUrl(trimmed) : undefined
  const useEmbed = !!embedUrl && embedUrl !== trimmed
  return {
    platform: 'bilibili',
    keyword: trimmed,
    originalUrl: isUrl ? trimmed : undefined,
    embedUrl,
    mode: useEmbed ? 'embed' : undefined,
    url: useEmbed ? embedUrl! : isUrl ? trimmed : `https://search.bilibili.com/all?keyword=${encodeURIComponent(trimmed)}`,
    title: isUrl ? 'B站视频' : `B站 · ${trimmed}`,
  }
}

export function CinemaRoom({ adapters, personaProfile, onOpenChat, onOpenChatWithConv, onOpenPersona, onOpenMemory }: Props) {
  const [bilibiliUrl, setBilibiliUrl] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [frameSource, setFrameSource] = useState<WebFrameSource | null>(null)
  const [frameVisible, setFrameVisible] = useState(false)

  // 陪看对话
  const [cinemaMessages, setCinemaMessages] = useState<ConversationMessage[]>([])
  const [cinemaInput, setCinemaInput] = useState('')
  const [cinemaLoading, setCinemaLoading] = useState(false)
  const cinemaBottomRef = useRef<HTMLDivElement>(null)
  const prevVideoRef = useRef<string>('')
  const cinemaConvIdRef = useRef<string>('')

  // 延迟回复状态
  const [cinemaDelayedPending, setCinemaDelayedPending] = useState(false)
  const cinemaDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cinemaPendingRef = useRef<string[]>([])

  const clearCinemaDelay = () => {
    if (cinemaDelayTimerRef.current) {
      clearTimeout(cinemaDelayTimerRef.current)
      cinemaDelayTimerRef.current = null
    }
  }

  const getDelayedSettings = () => {
    try {
      const raw = localStorage.getItem('kico_ombre_uplink_v1')
      if (!raw) return { enabled: false, delay: 10000 }
      const s = JSON.parse(raw)
      return { enabled: s.delayedReply === true, delay: s.delayMs || 10000 }
    } catch { return { enabled: false, delay: 10000 } }
  }

  // 初始化陪看对话（复用 localStorage 中的记录）
  useEffect(() => {
    const existingId = localStorage.getItem('kico_cinema_conv_id') || ''
    if (existingId && getConversation(existingId)) {
      cinemaConvIdRef.current = existingId
      const existing = getConversation(existingId)
      if (existing && existing.messages.length > 0) {
        setCinemaMessages(existing.messages)
        return
      }
    }
    const conv = createConversation('🎬 陪看记录')
    cinemaConvIdRef.current = conv.id
    localStorage.setItem('kico_cinema_conv_id', conv.id)
  }, [])

  // 自动持久化陪看消息到对话存储
  useEffect(() => {
    if (cinemaMessages.length > 0 && cinemaConvIdRef.current) {
      appendConversationMessages(cinemaConvIdRef.current, cinemaMessages)
    }
  }, [cinemaMessages])

  // 自动滚动到最新消息
  useEffect(() => {
    cinemaBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [cinemaMessages])

  // 视频加载 → 自动启动陪看
  useEffect(() => {
    if (frameSource && frameVisible && frameSource.title !== prevVideoRef.current) {
      prevVideoRef.current = frameSource.title
      const contextMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        text: `[正在观影] 我在看 ${frameSource.title}${
          frameSource.embedUrl ? '，弹幕已关闭' : ''
        }。陪我看好不好？`,
        createdAt: new Date().toISOString(),
      }
      setCinemaMessages(prev => [...prev, contextMsg])
      doCinemaSend(contextMsg.text)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameSource, frameVisible])

  const handleLoad = useCallback(() => {
    const url = bilibiliUrl.trim()
    if (!url) return
    const source = createBilibiliFrameSource(url)
    setFrameSource(source)
    setFrameVisible(true)
  }, [bilibiliUrl])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && bilibiliUrl.trim()) {
      handleLoad()
    }
  }, [bilibiliUrl, handleLoad])

  const flushCinemaPending = () => {
    clearCinemaDelay()
    const texts = cinemaPendingRef.current.slice()
    cinemaPendingRef.current = []
    setCinemaDelayedPending(false)
    if (texts.length > 0) {
      doCinemaSend(texts.join('\n———\n'))
    }
  }

  const doCinemaSend = async (text: string) => {
    if (cinemaLoading) return
    setCinemaLoading(true)

    try {
      const personaCore = await adapters.persona.getPersonaCore()
      const userContext = await adapters.persona.getUserContext?.() || ''
      const memories = await adapters.memory.retrieveRelevant(text, 3)

      const recentMessages = cinemaMessages.slice(-6).map(m => ({
        role: m.role as 'user' | 'companion',
        text: m.text,
      }))

      const watchContext = frameSource ? {
        title: frameSource.title,
        currentTime: 0,
        duration: 0,
        sourceType: 'web-url' as const,
        subtitleWindow: { previous: [], next: [] },
      } : {
        title: '',
        currentTime: 0,
        duration: 0,
        sourceType: 'web-url' as const,
        subtitleWindow: { previous: [], next: [] },
      }

      const request: CompanionRequest = {
        mode: 'cinema',
        userMessage: text,
        personaCore,
        userContext,
        memories,
        recentMessages,
        watch: watchContext,
        onStreamUpdate: (streamText) => {
          setCinemaMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.role === 'companion') {
              updated[updated.length - 1] = { ...last, text: streamText }
            }
            return updated
          })
        },
      }

      const placeholderMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'companion',
        text: '',
        createdAt: new Date().toISOString(),
      }
      setCinemaMessages(prev => [...prev, placeholderMsg])

      const response = await adapters.llm.complete(request)

      setCinemaMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'companion') {
          updated[updated.length - 1] = {
            ...last,
            text: response.text,
            modelUsed: response.modelUsed,
            tokenCount: response.tokenCount,
          }
        }
        return updated
      })
    } catch (err) {
      setCinemaMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'companion',
        text: `[陪看错误] ${err instanceof Error ? err.message : '请求失败'}`,
        createdAt: new Date().toISOString(),
      }])
    } finally {
      setCinemaLoading(false)
    }
  }

  const handleCinemaSend = () => {
    const text = cinemaInput.trim()
    if (!text || cinemaLoading || !frameSource) return
    setCinemaInput('')

    const userMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    }
    setCinemaMessages(prev => [...prev, userMsg])

    const delayCfg = getDelayedSettings()
    if (delayCfg.enabled) {
      cinemaPendingRef.current.push(text)
      setCinemaDelayedPending(true)
      clearCinemaDelay()
      cinemaDelayTimerRef.current = setTimeout(() => flushCinemaPending(), delayCfg.delay)
    } else {
      doCinemaSend(text)
    }
  }

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => clearCinemaDelay()
  }, [])

  return (
    <div className="page-view">
      <div className="page-header">
        <span>🎬 观影室</span>
      </div>

      <div className="cinema-layout">
        {/* 视频区域 */}
        <div className="cinema-stage">
          {frameSource && frameVisible ? (
            <div className="cinema-player-wrapper">
              <iframe
                title={frameSource.title}
                src={frameSource.url}
                className="cinema-iframe"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
              <div className="cinema-player-footer">
                <span className="cinema-source-label">{frameSource.title}</span>
                {frameSource.embedUrl && frameSource.originalUrl && (
                  <button
                    className="text-btn"
                    onClick={() => {
                      setFrameSource(prev => {
                        if (!prev) return prev
                        const usePage = prev.url === prev.embedUrl
                        return {
                          ...prev,
                          url: usePage ? prev.originalUrl! : prev.embedUrl!,
                        }
                      })
                    }}
                    style={{ fontSize: 12 }}
                  >
                    <ExternalLink size={12} /> 切换内嵌/原站
                  </button>
                )}
                <button className="text-btn" onClick={() => setFrameVisible(false)} style={{ fontSize: 12, marginLeft: 'auto' }}>
                  关闭
                </button>
              </div>
            </div>
          ) : (
            <div className="cinema-empty">
              <Play size={48} className="cinema-play-icon" />
              <p>输入 B站链接或选择本地文件开始观影</p>

              <div className="cinema-url-input">
                <input
                  type="text"
                  value={bilibiliUrl}
                  onChange={e => setBilibiliUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="粘贴 B站视频链接..."
                />
                <button className="send-btn" onClick={handleLoad} disabled={!bilibiliUrl.trim()}>
                  加载
                </button>
              </div>

              <div className="cinema-actions">
                <button className="cinema-action-btn" onClick={onOpenChat}>
                  <MessageCircle size={16} /> 陪看对话
                </button>
                <button className="cinema-action-btn" onClick={onOpenPersona}>
                  <UserRound size={16} /> 切换人格
                </button>
                <button className="cinema-action-btn" onClick={onOpenMemory}>
                  <Database size={16} /> 查看记忆
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 陪看切换按钮（手机用） */}
        <button className="cinema-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? '收起陪看 ▲' : '展开陪看 ▼'}
        </button>

        {/* 陪看对话面板 */}
        <div className={`cinema-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
          <div className="cinema-sidebar-header">
            <span>陪看 · {frameSource?.title || '未播放'}</span>
            <button className="text-btn" onClick={() => { if (cinemaConvIdRef.current) onOpenChatWithConv(cinemaConvIdRef.current); else onOpenChat(); }}>全屏对话</button>
          </div>
          <div className="cinema-sidebar-body">
            {cinemaMessages.length === 0 ? (
              <p className="cinema-sidebar-hint">
                加载视频后，AI 会在这里陪你一起看。
                <br />
                可以吐槽剧情、分析镜头、聊聊背后的设定。
              </p>
            ) : (
              <>
                {cinemaMessages.map(msg => (
                  <div key={msg.id} className={`cinema-chat-bubble ${msg.role}`}>
                    <div className="cinema-chat-text">{msg.text}</div>
                    {msg.modelUsed && (
                      <div className="cinema-chat-meta">{msg.modelUsed}</div>
                    )}
                  </div>
                ))}
                <div ref={cinemaBottomRef} />
                {cinemaLoading && (
                  <div className="cinema-chat-loading">瞎子在思考...</div>
                )}
              </>
            )}
          </div>
          <div className="cinema-chat-input-bar">
            {cinemaDelayedPending && (
              <button
                onClick={flushCinemaPending}
                className="send-btn"
                style={{ fontSize: 11, padding: '4px 10px', marginRight: 4, flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                结束等待
              </button>
            )}
            <input
              className="cinema-chat-input"
              value={cinemaInput}
              onChange={e => setCinemaInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCinemaSend()
                }
              }}
              placeholder={cinemaDelayedPending ? "继续输入或点结束等待..." : (frameSource ? "吐槽两句..." : "先加载视频吧")}
              disabled={!frameSource || cinemaLoading}
            />
            <button
              className="cinema-chat-send"
              onClick={handleCinemaSend}
              disabled={!cinemaInput.trim() || cinemaLoading || !frameSource}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}