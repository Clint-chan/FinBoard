import { useState, useEffect, useRef } from 'react'
import type { StockData } from '@/types'
import { fmtNum } from '@/utils/format'
import './Modal.css'

interface CostModalProps {
  open: boolean
  code: string | null
  stockData?: StockData
  currentCost?: number
  onClose: () => void
  onSave: (code: string, cost: number | null) => void
}

function CostModal({ open, code, stockData, currentCost, onClose, onSave }: CostModalProps) {
  const [cost, setCost] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setCost(currentCost?.toString() || '')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, currentCost])

  const handleSave = () => {
    if (!code) return
    const value = parseFloat(cost)
    if (!isNaN(value) && value > 0) {
      onSave(code, value)
    }
  }

  const handleClear = () => {
    if (!code) return
    onSave(code, null)
  }

  if (!open) return null

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{stockData?.name || code} 持仓成本</div>
        
        <div className="form-group">
          <label>成本价</label>
          <input
            ref={inputRef}
            type="text"
            className="form-input"
            inputMode="decimal"
            placeholder="输入买入成本价"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
          <div className="current-price-hint">当前价: {fmtNum(stockData?.price)}</div>
        </div>

        <div className="modal-actions">
          <button onClick={handleClear}>清除成本</button>
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}

export default CostModal
