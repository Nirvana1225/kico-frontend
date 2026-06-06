import { useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { queryMemoryByText } from '../adapters/ombreMemory'
import type { MemorySnippet } from '../types'

interface Props {
  onClose: () => void
}

export function MemoryPage({ onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemorySnippet[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await queryMemoryByText(query, 20)
      setResults(res)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-view">
      <div className="page-header">
        <button className="icon-btn" onClick={onClose}><ArrowLeft size={18} /></button>
        <span>📚 记忆库</span>
      </div>

      <div className="page-body">
        <div className="memory-search-bar">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索记忆..."
          />
          <button className="send-btn" onClick={handleSearch} disabled={loading}>
            <Search size={16} />
          </button>
        </div>

        <div className="memory-list">
          {!searched && (
            <div className="empty-hint">输入关键词，从 OmbreBrain 记忆库中搜索</div>
          )}

          {searched && results.length === 0 && !loading && (
            <div className="empty-hint">未找到相关记忆</div>
          )}

          {results.map((mem, i) => (
            <div key={mem.id || i} className="memory-item">
              <div className="memory-item-title">{mem.title}</div>
              <div className="memory-item-text">{mem.text}</div>
              {mem.score !== undefined && (
                <div className="memory-item-score">相关度: {Math.round((mem.score ?? 0) * 100)}%</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}