import { useState, useRef, useEffect } from 'react'
import type { StockCategory } from '@/types'
import './ContextMenu.css'

interface ContextMenuProps {
  open: boolean
  x: number
  y: number
  code: string | null
  categories?: StockCategory[]
  onClose: () => void
  onSetAlert: () => void
  onSetCost: () => void
  onDelete: () => void
  onMoveToCategory?: (categoryId: string | null) => void
  onCreateCategory?: (name: string) => void
  onViewBidAsk?: () => void
}

function ContextMenu({
  open,
  x,
  y,
  code,
  categories = [],
  onClose,
  onSetAlert,
  onSetCost,
  onDelete,
  onMoveToCategory,
  onCreateCategory,
  onViewBidAsk
}: ContextMenuProps) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const categoryMenuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const menuWidth = 160
  const menuHeight = 180
  const maxX = window.innerWidth - menuWidth - 10
  const maxY = window.innerHeight - menuHeight - 10

  // 关闭时重置状态
  useEffect(() => {
    if (!open) {
      setShowCategoryMenu(false)
      setIsCreating(false)
      setNewCategoryName('')
    }
  }, [open])

  // 聚焦输入框
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  // 检查股票是否在某个分类中
  const isInCategory = (categoryId: string) => {
    if (!code) return false
    const category = categories.find((c) => c.id === categoryId)
    return category?.codes.includes(code) ?? false
  }

  // 检查股票是否在任何分类中
  const isInAnyCategory = () => {
    if (!code) return false
    return categories.some((c) => c.codes.includes(code))
  }

  // 创建新分类并添加
  const handleCreateAndAdd = () => {
    const name = newCategoryName.trim()
    if (name && onCreateCategory) {
      onCreateCategory(name)
    }
    setIsCreating(false)
    setNewCategoryName('')
    onClose()
  }

  return (
    <div
      className={`context-menu ${open ? 'show' : ''}`}
      style={{
        left: Math.min(x, maxX),
        top: Math.min(y, maxY),
        display: open ? 'block' : 'none'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="context-menu-item"
        onClick={() => {
          onSetAlert()
          onClose()
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" className="menu-icon" style={{ marginRight: 6 }} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        设置价格预警
      </div>
      <div
        className="context-menu-item"
        onClick={() => {
          onSetCost()
          onClose()
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" className="menu-icon" style={{ marginRight: 6 }} fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        设置持仓成本
      </div>

      {/* 查看内外盘 */}
      {onViewBidAsk && (
        <div
          className="context-menu-item"
          onClick={() => {
            onViewBidAsk()
            onClose()
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" className="menu-icon" style={{ marginRight: 6 }}>
            <path d="M3 3v18h18" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M7 12l3-3 3 3 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          查看内外盘
        </div>
      )}

      {/* 分类菜单 */}
      {onMoveToCategory && (
        <div
          className="context-menu-item has-submenu"
          onMouseEnter={() => setShowCategoryMenu(true)}
          onMouseLeave={() => !isCreating && setShowCategoryMenu(false)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" className="menu-icon" style={{ marginRight: 6 }} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>添加到分类</span>
          <svg className="submenu-arrow" viewBox="0 0 24 24" width="14" height="14">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>

          {/* 子菜单 */}
          {showCategoryMenu && (
            <div
              ref={categoryMenuRef}
              className="context-submenu"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 从所有分类中移除 */}
              {isInAnyCategory() && (
                <>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      onMoveToCategory(null)
                      onClose()
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" className="menu-icon">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    从所有分类移除
                  </div>
                  <div className="context-menu-divider" />
                </>
              )}

              {/* 现有分类 - 点击切换勾选状态 */}
              {categories.map((category) => {
                const checked = isInCategory(category.id)
                return (
                  <div
                    key={category.id}
                    className={`context-menu-item ${checked ? 'active' : ''}`}
                    onClick={() => {
                      onMoveToCategory(category.id)
                      // 不关闭菜单，允许继续选择其他分类
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      className={`menu-icon check ${checked ? 'visible' : ''}`}
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>{category.name}</span>
                  </div>
                )
              })}

              {/* 分隔线 */}
              {categories.length > 0 && <div className="context-menu-divider" />}

              {/* 新建分类 */}
              {isCreating ? (
                <div className="context-menu-item creating">
                  <input
                    ref={inputRef}
                    type="text"
                    className="category-input"
                    placeholder="输入分类名称"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateAndAdd()
                      if (e.key === 'Escape') {
                        setIsCreating(false)
                        setNewCategoryName('')
                      }
                    }}
                    onBlur={() => {
                      if (!newCategoryName.trim()) {
                        setIsCreating(false)
                      }
                    }}
                  />
                  <button className="category-confirm-btn" onClick={handleCreateAndAdd}>
                    确定
                  </button>
                </div>
              ) : (
                <div
                  className="context-menu-item add-category"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsCreating(true)
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" className="menu-icon">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  新建分类
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="context-menu-divider" />
      <div
        className="context-menu-item danger"
        onClick={() => {
          onDelete()
          onClose()
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" className="menu-icon" style={{ marginRight: 6 }} fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        删除此股票
      </div>
    </div>
  )
}

export default ContextMenu
