import { useRef, useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Send, Save, BookmarkPlus } from 'lucide-react'
import type { CompanionAdapters, PersonaProfile, ConversationMessage, CompanionRequest } from '../../types'
import { createConversation, appendConversationMessages, getConversation } from '../../storage/conversations'
import { saveConversationHighlights } from '../../adapters/memoryWriter'

interface Props {
  adapters: CompanionAdapters
  personaProfile: PersonaProfile
  onClose: () => void
  initialConversationId?: string
}

// 自动保存：每满6轮对话静默存一次
const AUTO_SAVE_INTERVAL = 6

export function ChatPage({ adapters, personaProfile, onClose, initialConversationId }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [conversationId, setConversationId] = useState<string>('')
  const [conversationTitle, setConversationTitle] = useState('')
  const [savingMemory, setSavingMemory] = useState(false)
  const [savedLabel, setSavedLabel] = useState('')
  // 记录上次自动保存时的消息数
  const lastAutoSaveCount = useRef(0)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const bottomRef = useRef<HTMLDivElement>(null)

  // 提取保存逻辑为独立函数（手动&自动共用）
  const doSaveMemory = useCallback(async (msgs: ConversationMessage[], silent = false) => {
    if (msgs.length < 2 || savingMemory) return
    setSavingMemory(true)
    try {
      const activePersona = personaProfile.personas.find(p => p.id === personaProfile.activePersonaId)
      const personaName = activePersona?.name || 'AI'
      const conv = getConversation(conversationId)
      const title = conv?.title || '未命名对话'
      const count = await saveConversationHighlights(title, msgs, personaName)
      if (!silent) {
        setSavedLabel(`已保存 ${count} 条记忆`)
        setTimeout(() => setSavedLabel(''), 3000)
      }
      return count
    } catch {
      if (!silent) setSavedLabel('保存失败')
      return 0
    } finally {
      setSavingMemory(false)
    }
  }, [conversationId, personaProfile, savingMemory])

  // 初始化：恢复已有对话或新建
  useEffect(() => {
    let convId = initialConversationId || localStorage.getItem('kico_active_conv_id') || ''
    if (convId) {
      const existing = getConversation(convId)
      if (existing) {
        setMessages(existing.messages)
        setConversationId(convId)
        setConversationTitle(existing.title)
        lastAutoSaveCount.current = existing.messages.length
        return
      }
    }
    const conv = createConversation()
    setConversationId(conv.id)
    setConversationTitle(conv.title)
    localStorage.setItem('kico_active_conv_id', conv.id)
  }, [initialConversationId])

  // 持久化到localStorage
  const persistMessages = useCallback((msgs: ConversationMessage[]) => {
    if (conversationId) {
      appendConversationMessages(conversationId, msgs)
    }
  }, [conversationId])

  useEffect(() => {
    if (conversationId && messages.length > 0) {
      persistMessages(messages)
    }
  }, [messages, conversationId, persistMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 自动保存：每新增AUTO_SAVE_INTERVAL轮对话静默触发一次
  useEffect(() => {
    const userMsgs = messages.filter(m => m.role === 'user')
    if (userMsgs.length >= AUTO_SAVE_INTERVAL && 
        (userMsgs.length - lastAutoSaveCount.current) >= AUTO_SAVE_INTERVAL) {
      lastAutoSaveCount.current = userMsgs.length
      doSaveMemory(messages, true)
    }
  }, [messages, doSaveMemory])

  // 离开页面时自动存
  useEffect(() => {
    return () => {
      if (messagesRef.current.length >= 2) {
        doSaveMemory(messagesRef.current, true)
      }
    }
  }, [doSaveMemory])

  // 手动写入记忆
  const handleSaveMemory = async () => {
    await doSaveMemory(messages, false)
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userText = input.trim()
    setInput('')
    setLoading(true)

    const userMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: userText,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const personaCore = await adapters.persona.getPersonaCore()
      const userContext = await adapters.persona.getUserContext?.() || ''
      const memories = memoryEnabled ? await adapters.memory.retrieveRelevant(userText, 4) : []

      const recentMessages = messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'companion',
        text: m.text,
      }))

      const request: CompanionRequest = {
        mode: 'chat',
        userMessage: userText,
        personaCore,
        userContext,
        memories,
        recentMessages,
        watch: {
          title: '',
          currentTime: 0,
          duration: 0,
          sourceType: 'web-url',
          subtitleWindow: { previous: [], next: [] },
        },
        onStreamUpdate: (text) => {
          setMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last.role === 'companion') {
              updated[updated.length - 1] = { ...last, text }
            }
            return updated
          })
        },
      }

      // 先放一个占位消息
      const placeholderMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'companion',
        text: '',
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, placeholderMsg])

      const response = await adapters.llm.complete(request)

      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last.role === 'companion') {
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
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'companion',
        text: `错误: ${err instanceof Error ? err.message : '请求失败'}`,
        createdAt: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-view">
      <div className="page-header">
        <button className="icon-btn" onClick={onClose}><ArrowLeft size={18} /></button>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={conversationTitle}>
          {conversationTitle || '长对话'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          {savedLabel && <span style={{ color: 'var(--accent)', fontSize: 12 }}>{savedLabel}</span>}
          <button
            className="icon-btn"
            onClick={handleSaveMemory}
            disabled={savingMemory || messages.length < 2}
            title="写入记忆库"
            style={{ position: 'relative' }}
          >
            <BookmarkPlus size={16} />
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={memoryEnabled} onChange={e => setMemoryEnabled(e.target.checked)} />
            记忆
          </label>
        </div>
      </div>

      <div className="chat-messages-area">
        {messages.map(msg => (
          <div key={msg.id} className={`chat-bubble ${msg.role}`}>
            <div className="chat-text">{msg.text}</div>
            {msg.modelUsed && (
              <div className="chat-meta">{msg.modelUsed}{msg.tokenCount ? ` · ${msg.tokenCount} tokens` : ''}</div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          placeholder="输入消息..."
          rows={1}
          disabled={loading}
        />
        <button className="send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}