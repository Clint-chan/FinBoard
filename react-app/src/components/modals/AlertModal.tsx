import { useState, useEffect, useRef } from 'react'
import type { StockData, AlertCondition } from '@/types'
import { fmtNum } from '@/utils/format'
import './Modal.css'

interface AlertModalProps {
  open: boolean
  code: string | null
  stockData?: StockData
  conditions: AlertCondition[]
  onClose: () => void
  onSave: (code: string, conditions: AlertCondition[]) => void
  initialPrice?: number // 预填充的价格
  editIndex?: number // 编辑特定条件的索引
}

function AlertModal({ open, code, stockData, conditions: initialConditions, onClose, onSave, initialPrice, editIndex }: AlertModalProps) {
  const [conditions, setConditions] = useState<AlertCondition[]>([])
  const isEditMode = editIndex !== undefined && editIndex >= 0
  // 记录上一次的 open 状态，只在从关闭变为打开时初始化
  const prevOpenRef = useRef(false)

  useEffect(() => {
    // 只在弹窗从关闭变为打开时初始化条件
    if (open && !prevOpenRef.current) {
      if (isEditMode && initialConditions?.[editIndex]) {
        // 编辑模式：只显示要编辑的那一条
        setConditions([{ ...initialConditions[editIndex] }])
      } else if (initialPrice && !initialConditions?.length) {
        // 如果提供了初始价格且没有现有条件，自动添加一个价格预警
        const currentPrice = stockData?.price || initialPrice
        const operator = initialPrice > currentPrice ? 'above' : 'below'
        setConditions([{ type: 'price', operator, value: initialPrice }])
      } else {
        setConditions(initialConditions?.length ? [...initialConditions] : [])
      }
    }
    prevOpenRef.current = open
  }, [open]) // 只依赖 open 状态

  const addCondition = () => {
    setConditions([...conditions, { type: 'price', operator: 'above', value: 0 }])
  }

  const updateCondition = (idx: number, field: keyof AlertCondition, value: string | number) => {
    const newConditions = [...conditions]
    newConditions[idx] = { ...newConditions[idx], [field]: value }
    setConditions(newConditions)
  }

  const deleteCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    if (!code) return
    const validConditions = conditions.filter(c => {
      const val = typeof c.value === 'string' ? parseFloat(c.value) : c.value
      return !isNaN(val) && val !== 0
    }).map(c => ({
      type: c.type,
      operator: c.operator,
      value: typeof c.value === 'string' ? parseFloat(c.value) : c.value,
      note: c.note || undefined
    }))
    
    if (isEditMode) {
      // 编辑模式：替换原来的条件
      const newConditions = [...initialConditions]
      if (validConditions.length > 0) {
        newConditions[editIndex] = validConditions[0]
      } else {
        // 如果编辑后条件无效，删除该条件
        newConditions.splice(editIndex, 1)
      }
      onSave(code, newConditions)
    } else {
      onSave(code, validConditions)
    }
  }

  if (!open) return null

  const pct = stockData?.preClose ? ((stockData.price - stockData.preClose) / stockData.preClose * 100) : 0
  const pctSign = pct >= 0 ? '+' : ''

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-content alert-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{stockData?.name || code} {isEditMode ? '编辑预警' : '预警设置'}</div>
        
        <div className="alert-stock-info">
          <span className="alert-stock-price">当前价: {fmtNum(stockData?.price)}</span>
          <span className="alert-stock-pct">涨跌: {pctSign}{pct.toFixed(2)}%</span>
        </div>

        <div className="alert-conditions">
          {conditions.length === 0 ? (
            <div className="alert-empty">暂无预警条件，点击下方按钮添加</div>
          ) : (
            conditions.map((cond, idx) => (
              <div key={idx} className="alert-condition-wrapper">
                <div className="alert-condition">
                  <select
                    value={cond.type}
                    onChange={(e) => updateCondition(idx, 'type', e.target.value as 'price' | 'pct')}
                  >
                    <option value="price">价格</option>
                    <option value="pct">涨跌幅</option>
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(idx, 'operator', e.target.value as 'above' | 'below')}
                  >
                    <option value="above">{cond.type === 'pct' ? '≥' : '突破'}</option>
                    <option value="below">{cond.type === 'pct' ? '≤' : '跌破'}</option>
                  </select>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cond.value}
                    placeholder={cond.type === 'price' ? '价格' : '百分比'}
                    onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                  />
                  <span className="alert-unit">{cond.type === 'pct' ? '%' : ''}</span>
                  <button className="alert-del-btn" onClick={() => deleteCondition(idx)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  className="alert-note-input"
                  value={cond.note || ''}
                  placeholder="备注（可选）"
                  onChange={(e) => updateCondition(idx, 'note', e.target.value)}
                />
              </div>
            ))
          )}
        </div>

        <button className="alert-add-btn" onClick={addCondition}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          添加条件
        </button>

        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  )
}

export default AlertModal
