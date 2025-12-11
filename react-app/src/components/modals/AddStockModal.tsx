import { useState, useEffect, useRef } from 'react'
import { searchStock, normalizeCode } from '@/services/dataService'
import type { SearchResult } from '@/types'
import './Modal.css'

interface AddStockModalProps {
  open: boolean
  onClose: () => void
  onAdd: (code: string) => void
  existingCodes: string[]
}

function AddStockModal({ open, onClose, onAdd, existingCodes }: AddStockModalProps) {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setKeyword('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    if (!keyword.trim()) {
      setResults([])
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    
    timerRef.current = window.setTimeout(async () => {
      setLoading(true)
      try {
        const items = await searchStock(keyword)
        setResults(items)
      } catch {
        setResults([])
      }
      setLoading(false)
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [keyword])

  const handleSelect = (code: string) => {
    const normalized = normalizeCode(code)
    if (!existingCodes.includes(normalized)) {
      onAdd(normalized)
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">添加股票</div>
        <div className="form-group">
          <div className="search-container">
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="输入股票代码或名称..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              autoComplete="off"
            />
            {results.length > 0 && (
              <div className="search-results show">
                {results.map(item => (
                  <div
                    key={item.code}
                    className="search-item"
                    onClick={() => handleSelect(item.code)}
                  >
                    <span className="search-item-name">{item.name}</span>
                    <span className="search-item-code">{item.code.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
            {keyword && results.length === 0 && !loading && (
              <div className="search-results show">
                <div className="search-item" style={{ color: 'var(--text-tertiary)' }}>
                  未找到结果
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  )
}

export default AddStockModal
