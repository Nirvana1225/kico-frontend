import { useState, useCallback, useRef, useEffect } from 'react'
import { BookOpen, Send, MessageCircle, ChevronLeft, ChevronRight, Plus, Trash2, Clock, Upload } from 'lucide-react'
import type { CompanionAdapters, ConversationMessage, CompanionRequest, PersonaProfile } from '../types'
import * as mammoth from 'mammoth'

const GATEWAY_URL = 'https://mr-blinds-hose.zeabur.app'

/** 推送当前阅读状态到网关缓存 */
function pushKicoState(book: BookRecord | null, sectionIdx: number) {
  if (!book) {
    fetch(`${GATEWAY_URL}/api/v1/kico/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active: false,
        book_id: '',
        book_title: '',
        section_index: 0,
        section_title: '',
        progress: 0.0,
      }),
    }).catch(e => console.warn('[kico-push] state(off):', e))
    return
  }
  const section = book.sections[sectionIdx]
  if (!section) {
    console.warn('[kico-push] no section at index', sectionIdx, 'sections:', book.sections.length)
    return
  }
  const progress = book.sections.length > 1 ? sectionIdx / (book.sections.length - 1) : 1.0
  fetch(`${GATEWAY_URL}/api/v1/kico/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      active: true,
      book_id: book.id,
      book_title: book.title,
      section_index: sectionIdx,
      section_title: section.title,
      progress,
    }),
  }).then(r => { if (!r.ok) console.warn('[kico-push] state status:', r.status) })
    .catch(e => console.warn('[kico-push] state(on):', e))
}

/** 推送书架列表到网关缓存 */
function pushKicoBooklist(books: BookRecord[]) {
  const list = books.map(b => ({
    id: b.id,
    title: b.title,
    author: '',
    cover: '',
  }))
  fetch(`${GATEWAY_URL}/api/v1/kico/booklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list),
  }).then(r => { if (!r.ok) console.warn('[kico-push] booklist status:', r.status) })
    .catch(e => console.warn('[kico-push] booklist:', e))
}

interface Props {
  adapters: CompanionAdapters
  personaProfile: PersonaProfile
}

interface BookSection {
  id: string
  title: string
  text: string
}

interface BookRecord {
  id: string
  title: string
  sections: BookSection[]
  currentSection: number
  lastReadAt: number
  createdAt: number
}

const BOOKSHELF_KEY = 'kico_bookshelf'
const CHAT_PREFIX = 'kico_coread_chat_'

function loadChatHistory(bookId: string): ConversationMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_PREFIX + bookId)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveChatHistory(bookId: string, messages: ConversationMessage[]) {
  if (messages.length === 0) {
    localStorage.removeItem(CHAT_PREFIX + bookId)
  } else {
    localStorage.setItem(CHAT_PREFIX + bookId, JSON.stringify(messages))
  }
}

// 从 localStorage 读取书架
function loadBookshelf(): BookRecord[] {
  try {
    const raw = localStorage.getItem(BOOKSHELF_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

// 写入书架
function saveBookshelf(books: BookRecord[]) {
  localStorage.setItem(BOOKSHELF_KEY, JSON.stringify(books))
}

// 兼容旧版单书数据
function migrateOldBook(): BookRecord | null {
  try {
    const old = localStorage.getItem('kico_coread_book')
    if (!old) return null
    const data = JSON.parse(old)
    if (!data.sections?.length) return null
    const book: BookRecord = {
      id: crypto.randomUUID(),
      title: data.title || '未命名',
      sections: data.sections,
      currentSection: data.currentSection || 0,
      lastReadAt: Date.now(),
      createdAt: Date.now(),
    }
    localStorage.removeItem('kico_coread_book')
    return book
  } catch { return null }
}

export function CoReadPage({ adapters, personaProfile }: Props) {
  // 书架状态
  const [bookshelf, setBookshelf] = useState<BookRecord[]>(() => {
    const shelf = loadBookshelf()
    if (shelf.length > 0) return shelf
    // 首次加载：尝试迁移旧书
    const oldBook = migrateOldBook()
    if (oldBook) {
      saveBookshelf([oldBook])
      return [oldBook]
    }
    return []
  })
  const [activeBookId, setActiveBookId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  // 正在阅读的书籍
  const activeBook = activeBookId ? bookshelf.find(b => b.id === activeBookId) ?? null : null

  // 当前章节索引
  const [currentSection, setCurrentSection] = useState(0)
  // 同步 activeBook 的 currentSection
  useEffect(() => {
    if (activeBook) setCurrentSection(activeBook.currentSection)
  }, [activeBook?.id])

  // 推送书架列表到网关
  useEffect(() => {
    pushKicoBooklist(bookshelf)
  }, [bookshelf])

  // 推送阅读状态到网关：书籍/章节切换时
  useEffect(() => {
    pushKicoState(activeBook, currentSection)
  }, [activeBook?.id, currentSection])

  // 换章后滚动到章节开头
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [currentSection])

  // 导入相关
  const [importTitle, setImportTitle] = useState('')
  const [rawText, setRawText] = useState('')

  // 陪看对话
  const [chatMessages, setChatMessages] = useState<ConversationMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // 划段讨论
  const selectedTextRef = useRef('')
  const selectionPosRef = useRef({ x: 0, y: 0 })
  const [showChatBtn, setShowChatBtn] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const btnLockedRef = useRef(false) // 点击按钮时锁定，不让selectionchange清空ref

  // 文件上传
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 自动提取文件名作为书名
    const name = file.name.replace(/\.[^/.]+$/, '')
    setImportTitle(name)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      let text = ''

      if (ext === 'txt' || ext === 'md') {
        text = await file.text()
      } else if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        text = result.value
      } else {
        alert('暂不支持 .' + ext + ' 格式，支持: .txt / .md / .docx')
        return
      }

      setRawText(text)
    } catch (err) {
      alert('读取文件失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
    // 重置 input 以便重复选择同一文件
    e.target.value = ''
  }, [])

  // 自动保存聊天记录
  const prevBookIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeBook) return
    // 当切换书籍时，保存旧书的聊天
    if (prevBookIdRef.current && prevBookIdRef.current !== activeBook.id) {
      // 已在上一步通过 setChatMessages(loadChatHistory(newId)) 切换，不额外保存
    }
    prevBookIdRef.current = activeBook.id
    // 自动保存当前聊天（排除消息为空、结尾是空消息的流式状态）
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].text !== '') {
      saveChatHistory(activeBook.id, chatMessages)
    }
  }, [chatMessages, activeBook?.id])

  // 自动滚动
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // 切分章节
  const handleImport = useCallback(() => {
    if (!rawText.trim()) return
    const lines = rawText.split('\n')
    const detected: BookSection[] = []
    let currentId = 0
    let buffer: string[] = []
    let currentTitle = '开头'

    const chapterRegex = /^第[一二三四五六七八九十百零〇0-9]+[章节回篇部]|^Chapter\s+\d+|^Part\s+\d+|^序|^引子|^尾声/i

    for (const line of lines) {
      if (chapterRegex.test(line.trim()) && buffer.length > 0) {
        detected.push({
          id: `sec-${currentId++}`,
          title: currentTitle,
          text: buffer.join('\n').trim(),
        })
        buffer = []
        currentTitle = line.trim()
      } else {
        buffer.push(line)
      }
    }
    if (buffer.length > 0) {
      detected.push({
        id: `sec-${currentId++}`,
        title: currentTitle,
        text: buffer.join('\n').trim(),
      })
    }

    const title = importTitle || `共读 · ${detected[0]?.title || '无题'}`
    const newBook: BookRecord = {
      id: crypto.randomUUID(),
      title,
      sections: detected,
      currentSection: 0,
      lastReadAt: Date.now(),
      createdAt: Date.now(),
    }

    const updated = [...bookshelf, newBook]
    setBookshelf(updated)
    saveBookshelf(updated)
    setShowImport(false)
    setImportTitle('')
    setRawText('')
    setActiveBookId(newBook.id)
    setChatMessages([])
    setCurrentSection(0)
  }, [rawText, importTitle, bookshelf])

  // 删除书籍
  const handleDeleteBook = useCallback((id: string) => {
    saveChatHistory(id, []) // 清理聊天记录
    const updated = bookshelf.filter(b => b.id !== id)
    setBookshelf(updated)
    saveBookshelf(updated)
    if (activeBookId === id) {
      setActiveBookId(null)
      setChatMessages([])
    }
  }, [bookshelf, activeBookId])

  // 切换章节并保存进度
  const goSection = useCallback((idx: number) => {
    if (!activeBook || idx < 0 || idx >= activeBook.sections.length) return
    setCurrentSection(idx)
    const updated = bookshelf.map(b =>
      b.id === activeBook.id ? { ...b, currentSection: idx, lastReadAt: Date.now() } : b
    )
    setBookshelf(updated)
    saveBookshelf(updated)
  }, [activeBook, bookshelf])

  // 返回书架
  const backToShelf = useCallback(() => {
    if (activeBook) {
      // 保存当前书籍的聊天记录
      saveChatHistory(activeBook.id, chatMessages)
      const updated = bookshelf.map(b =>
        b.id === activeBook.id ? { ...b, lastReadAt: Date.now() } : b
      )
      setBookshelf(updated)
      saveBookshelf(updated)
    }
    setActiveBookId(null)
    setChatMessages([])
  }, [activeBook, bookshelf, chatMessages])

  // 发送聊书消息（底层，不经延迟）
  const doSend = useCallback(async (text: string, extraContext?: string) => {
    if (chatLoading || !activeBook) return
    setChatLoading(true)

    try {
      const personaCore = await adapters.persona.getPersonaCore()
      const userContext = await adapters.persona.getUserContext?.() || ''
      const memories = await adapters.memory.retrieveRelevant(text, 3)
      const recentMessages = chatMessages.slice(-6).map(m => ({
        role: m.role as 'user' | 'companion',
        text: m.text,
      }))

      const currentSec = activeBook.sections[currentSection]
      const sectionContext = currentSec
        ? `\n[共读上下文]\n书名：${activeBook.title}\n当前章节：${currentSec.title}\n章节内容（摘要）：${currentSec.text.slice(0, 800)}${currentSec.text.length > 800 ? '...' : ''}`
        : ''

      const request: CompanionRequest = {
        mode: 'coread',
        userMessage: text + (extraContext || '') + sectionContext,
        personaCore,
        userContext,
        memories,
        recentMessages,
        watch: { title: activeBook.title, currentTime: 0, duration: 0, sourceType: 'web-url', subtitleWindow: { previous: [], next: [] } },
        onStreamUpdate: (streamText) => {
          setChatMessages(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.role === 'companion') {
              updated[updated.length - 1] = { ...last, text: streamText }
            }
            return updated
          })
        },
      }

      const placeholder: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'companion', text: '', createdAt: new Date().toISOString(),
      }
      setChatMessages(prev => [...prev, placeholder])

      const response = await adapters.llm.complete(request)
      setChatMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'companion') {
          updated[updated.length - 1] = { ...last, text: response.text, modelUsed: response.modelUsed }
        }
        return updated
      })
    } catch (err) {
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'companion',
        text: `[错误] ${err instanceof Error ? err.message : '请求失败'}`,
        createdAt: new Date().toISOString(),
      }])
    } finally {
      setChatLoading(false)
      // 发消息后刷新阅读状态时间戳
      pushKicoState(activeBook, currentSection)
    }
  }, [chatLoading, activeBook, currentSection, chatMessages, adapters])

  // 延迟回复状态
  const [delayedPending, setDelayedPending] = useState(false)
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingTextsRef = useRef<string[]>([])

  const clearDelayTimer = () => {
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current)
      delayTimerRef.current = null
    }
  }

  const getDelayedSettings = useCallback(() => {
    try {
      const raw = localStorage.getItem('kico_ombre_uplink_v1')
      if (!raw) return { enabled: false, delay: 10000 }
      const s = JSON.parse(raw)
      return { enabled: s.delayedReply === true, delay: s.delayMs || 10000 }
    } catch { return { enabled: false, delay: 10000 } }
  }, [])

  const flushPending = useCallback(() => {
    clearDelayTimer()
    const texts = pendingTextsRef.current.slice()
    pendingTextsRef.current = []
    setDelayedPending(false)
    if (texts.length > 0) {
      doSend(texts.join('\n———\n'))
    }
  }, [doSend])

  // 发送聊书消息（顶层，含延迟逻辑）
  const handleSend = useCallback(() => {
    const text = chatInput.trim()
    if (!text || chatLoading || !activeBook) return
    setChatInput('')

    const userMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    }
    setChatMessages(prev => [...prev, userMsg])

    const delayCfg = getDelayedSettings()
    if (delayCfg.enabled) {
      // 延迟模式：加入缓冲，重置定时器
      pendingTextsRef.current.push(text)
      setDelayedPending(true)
      clearDelayTimer()
      delayTimerRef.current = setTimeout(() => flushPending(), delayCfg.delay)
    } else {
      // 立即模式
      doSend(text)
    }
  }, [chatInput, chatLoading, activeBook, doSend, getDelayedSettings, flushPending])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => clearDelayTimer()
  }, [])

  // 划段讨论：选中文字后弹出"聊这段"
  useEffect(() => {
    const handler = () => {
      if (btnLockedRef.current) return // 按钮点击锁定中，跳过清空
      const sel = window.getSelection()
      const text = sel?.toString().trim()
      if (text && text.length > 0 && text.length < 2000 && contentRef.current?.contains(sel?.anchorNode as Node)) {
        try {
          const range = sel?.getRangeAt(0)
          const rect = range?.getBoundingClientRect()
          if (rect) {
            selectionPosRef.current = { x: rect.left + rect.width / 2, y: rect.bottom + 6 }
          }
        } catch { /* ignore */ }
        selectedTextRef.current = text
        setShowChatBtn(true)
      } else {
        selectedTextRef.current = ''
        setShowChatBtn(false)
      }
    }
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  // 聊这段：引用原文 + 用户自己补充
  const handleChatSelection = useCallback(() => {
    const text = selectedTextRef.current
    btnLockedRef.current = false
    if (!text) return
    // 引用格式：> 原文 + 换行 + 用户光标输入
    const preview = text.length > 120 ? text.slice(0, 120) + '…' : text
    setChatInput(`> ${preview}\n\n`)
    selectedTextRef.current = ''
    setShowChatBtn(false)
    chatInputRef.current?.focus()
  }, [])

  // 格式化时间
  const fmtTime = (ts: number) => {
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <div className="page-view">
      <div className="page-header">
        <BookOpen size={18} />
        <span>{activeBook ? `共读 · ${activeBook.title}` : '📚 书架'}</span>
        {!activeBook && (
          <button className="text-btn" onClick={() => setShowImport(true)} style={{ marginLeft: 'auto' }}>
            <Plus size={14} /> 导入书籍
          </button>
        )}
        {activeBook && (
          <button className="text-btn" onClick={backToShelf} style={{ marginLeft: 'auto' }}>
            <BookOpen size={14} /> 书架
          </button>
        )}
      </div>

      {/* === 书架视图 === */}
      {!activeBook && !showImport && (
        <div className="page-body" style={{ padding: 16, overflow: 'auto' }}>
          {bookshelf.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12 }}>
              <BookOpen size={40} style={{ opacity: 0.3 }} />
              <p className="empty-hint">书架空空如也</p>
              <button className="send-btn" onClick={() => setShowImport(true)}>
                <Plus size={14} /> 导入第一本书
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {bookshelf.map(book => (
                <div
                  key={book.id}
                  className="settings-card"
                  style={{ cursor: 'pointer', transition: 'border-color 0.2s', border: '1px solid var(--border)' }}
                  onClick={() => { setActiveBookId(book.id); setChatMessages(loadChatHistory(book.id)) }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {book.sections.length} 章 · 上次读到 {book.sections[book.currentSection]?.title || '未知'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} /> {fmtTime(book.lastReadAt)}
                      </div>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={e => { e.stopPropagation(); handleDeleteBook(book.id) }}
                      style={{ color: 'var(--danger)', flexShrink: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {/* 进度条 */}
                  <div style={{ marginTop: 8, height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((book.currentSection + 1) / book.sections.length) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === 导入视图 === */}
      {showImport && (
        <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="settings-card">
            <div className="settings-card-title">📖 导入书籍</div>
            <div className="settings-group">
              <label className="settings-label">书名（可选）</label>
              <input className="settings-input" value={importTitle} onChange={e => setImportTitle(e.target.value)} placeholder="给本书起个名..." />
            </div>
            <div className="settings-group">
              <label className="settings-label">上传文件</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.docx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="text-btn" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} /> 选择文件
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>.txt / .md / .docx</span>
              </div>
              {rawText && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>✅ 已读取，共 {rawText.length} 字符</p>}
            </div>
            <div className="settings-group">
              <label className="settings-label">或粘贴全文</label>
              <textarea
                className="settings-textarea"
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="粘贴小说/文章全文...&#10;&#10;系统会自动按「第X章」「Chapter X」等标记切分章节"
                rows={10}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="send-btn" onClick={handleImport} disabled={!rawText.trim()}>
                导入并加入书架
              </button>
              <button className="text-btn" onClick={() => setShowImport(false)}>
                取消
              </button>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            支持自动识别：第X章 / Chapter X / Part X / 序 / 引子 / 尾声
          </p>
        </div>
      )}

      {/* === 阅读视图 === */}
      {activeBook && !showImport && (
        <div className="cinema-layout">
          {/* 左侧：阅读区 */}
          <div className="cinema-stage" style={{ background: 'var(--bg-primary)', flexDirection: 'column', overflow: 'hidden' }}>
            {/* 章节导航 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', width: '100%', flexShrink: 0 }}>
              <button className="icon-btn" onClick={() => goSection(currentSection - 1)} disabled={currentSection === 0}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, textAlign: 'center' }}>
                {activeBook.sections[currentSection]?.title || '未知章节'} · {currentSection + 1}/{activeBook.sections.length}
              </span>
              <button className="icon-btn" onClick={() => goSection(currentSection + 1)} disabled={currentSection >= activeBook.sections.length - 1}>
                <ChevronRight size={16} />
              </button>
            </div>
            {/* 章节内容 */}
            <div
              ref={contentRef}
              style={{ flex: 1, overflow: 'auto', padding: '20px 24px', lineHeight: 1.9, fontSize: 15, whiteSpace: 'pre-wrap', position: 'relative' }}
            >
              {activeBook.sections[currentSection]?.text || '（空）'}
              {/* 划段讨论浮动按钮 */}
              {showChatBtn && (
                <button
                  onPointerDown={() => { btnLockedRef.current = true }}
                  onClick={handleChatSelection}
                  style={{
                    position: 'fixed',
                    left: selectionPosRef.current.x,
                    top: selectionPosRef.current.y,
                    transform: 'translate(-50%, 0)',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    zIndex: 9999,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  聊这段
                </button>
              )}
            </div>
          </div>

          {/* 右侧：讨论区 */}
          <div className="cinema-sidebar" style={{ width: 300 }}>
            <div className="cinema-sidebar-header">
              <MessageCircle size={14} />
              <span>聊书</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeBook.sections[currentSection]?.title}</span>
            </div>
            <div className="cinema-sidebar-body" style={{ display: 'flex', flexDirection: 'column' }}>
              {chatMessages.length === 0 ? (
                <p className="cinema-sidebar-hint">
                  对当前章节有想法？在下面输入，瞎子陪你聊。
                  <br /><br />
                  可以讨论剧情、分析人物、猜伏笔。
                </p>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} className={`cinema-chat-bubble ${msg.role}`}>
                    <div className="cinema-chat-text">{msg.text}</div>
                    {msg.modelUsed && <div className="cinema-chat-meta">{msg.modelUsed}</div>}
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
              {chatLoading && <div className="cinema-chat-loading">瞎子在思考...</div>}
            </div>
            <div className="cinema-chat-input-bar">
              {delayedPending && (
                <button
                  onClick={flushPending}
                  className="send-btn"
                  style={{ fontSize: 11, padding: '4px 10px', marginRight: 4, flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  结束等待
                </button>
              )}
              <input
                ref={chatInputRef}
                className="cinema-chat-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={delayedPending ? '继续输入或点结束等待...' : "聊聊这段..."}
                disabled={chatLoading}
              />
              <button className="cinema-chat-send" onClick={handleSend} disabled={!chatInput.trim() || chatLoading}>
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}