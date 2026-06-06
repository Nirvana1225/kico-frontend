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

export function ChatPage({ adapters, personaProfile, onClose, initialConversationId }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(true)
  const [conversationId, setConversationId] = useState<string>('')
  const [savingMemory, setSavingMemory] = useState(false)
  const [savedLabel, setSavedLabel] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // 初始化：恢复已有对话或新建
  useEffect(() => {
    let convId = initialConversationId || localStorage.getItem('kico_active_conv_id') || ''
    if (convId) {
      const existing = getConversation(convId)
      if (existing) {
        setMessages(existing.messages)
        setConversationId(convId)
        return
      }
    }
    // 新建对话
    const conv = createConversation()
    setConversationId(conv.id)
    localStorage.setItem('kico_active_conv_id', conv.id)
  }, [initialConversationId])

  // 持久化：每次 messages 变化时保存到 localStorage
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

  // 手动写入记忆
  const handleSaveMemory = async () => {
    if (messages.length < 2 || savingMemory) return
    setSavingMemory(true)
    setSavedLabel('')
    try {
      const activePersona = personaProfile.personas.find(p => p.id === personaProfile.activePersonaId)
      const personaName = activePersona?.name || 'AI'
      const conv = getConversation(conversationId)
      const title = conv?.title || '未命名对话'
      const count = await saveConversationHighlights(title, messages, personaName)
      setSavedLabel(`已保存 ${count} 条记忆`)
      setTimeout(() => setSavedLabel(''), 3000)
    } catch (err) {
      setSavedLabel('保存失败')
    } finally {
      setSavingMemory(false)
    }
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
        <span>💬 长对话</span>
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