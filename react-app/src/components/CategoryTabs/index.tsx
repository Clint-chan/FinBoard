import { useState, useRef, useEffect, useCallback } from 'react'
import type { StockCategory } from '@/types'
import './CategoryTabs.css'

interface CategoryTabsProps {
  categories: StockCategory[]
  activeCategory: string | null // null 表示"全部"
  totalCount: number
  onCategoryChange: (categoryId: string | null) => void
  onCategoriesChange: (categories: StockCategory[]) => void
}

// 生成唯一 ID
const generateId = () => `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export function CategoryTabs({
  categories,
  activeCategory,
  totalCount,
  onCategoryChange,
  onCategoriesChange
}: CategoryTabsProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number; categoryId: string | null }>({
    open: false, x: 0, y: 0, categoryId: null
  })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 聚焦输入框
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isAdding])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, open: false }))
    if (contextMenu.open) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu.open])

  // 添加分类
  const handleAddCategory = () => {
    const name = newCategoryName.trim()
    if (!name) {
      setIsAdding(false)
      return
    }

    const newCategory: StockCategory = {
      id: generateId(),
      name,
      codes: []
    }
    onCategoriesChange([...categories, newCategory])
    setNewCategoryName('')
    setIsAdding(false)
  }

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent, categoryId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      open: true,
      x: e.clientX,
      y: e.clientY,
      categoryId
    })
  }

  // 删除分类
  const handleDeleteCategory = () => {
    if (!contextMenu.categoryId) return
    if (activeCategory === contextMenu.categoryId) {
      onCategoryChange(null)
    }
    onCategoriesChange(categories.filter(c => c.id !== contextMenu.categoryId))
    setContextMenu({ open: false, x: 0, y: 0, categoryId: null })
  }

  // 开始编辑
  const handleStartEdit = () => {
    if (!contextMenu.categoryId) return
    const category = categories.find(c => c.id === contextMenu.categoryId)
    if (category) {
      setEditingId(category.id)
      setEditingName(category.name)
    }
    setContextMenu({ open: false, x: 0, y: 0, categoryId: null })
  }

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) {
      setEditingId(null)
      return
    }
    onCategoriesChange(
      categories.map(c => c.id === editingId ? { ...c, name } : c)
    )
    setEditingId(null)
  }

  // 获取分类下的股票数量
  const getCategoryCount = (category: StockCategory) => category.codes.length

  // 拖拽开始
  const handleDragStart = useCallback((e: React.DragEvent, categoryId: string) => {
    setDraggingId(categoryId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', categoryId)
    // 添加拖拽时的样式
    const target = e.target as HTMLElement
    setTimeout(() => target.classList.add('dragging'), 0)
  }, [])

  // 拖拽结束
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement
    target.classList.remove('dragging')
    setDraggingId(null)
    setDragOverId(null)
  }, [])

  // 拖拽经过
  const handleDragOver = useCallback((e: React.DragEvent, categoryId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggingId && draggingId !== categoryId) {
      setDragOverId(categoryId)
    }
  }, [draggingId])

  // 拖拽离开
  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  // 放置
  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) return

    const fromIndex = categories.findIndex(c => c.id === draggingId)
    const toIndex = categories.findIndex(c => c.id === targetId)
    
    if (fromIndex === -1 || toIndex === -1) return

    const newCategories = [...categories]
    const [removed] = newCategories.splice(fromIndex, 1)
    newCategories.splice(toIndex, 0, removed)
    
    onCategoriesChange(newCategories)
    setDraggingId(null)
    setDragOverId(null)
  }, [draggingId, categories, onCategoriesChange])

  return (
    <div className="category-tabs-container" ref={containerRef}>
      {/* 全部标签 - 不可拖拽 */}
      <div
        className={`category-tab ${activeCategory === null ? 'active' : ''}`}
        onClick={() => onCategoryChange(null)}
      >
        <svg className="tab-icon" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="2"></rect>
          <rect x="14" y="3" width="7" height="7" rx="2"></rect>
          <rect x="14" y="14" width="7" height="7" rx="2"></rect>
          <rect x="3" y="14" width="7" height="7" rx="2"></rect>
        </svg>
        <span className="tab-label">自选股</span>
        <span className="count-badge">{totalCount}</span>
      </div>

      {/* 用户分类 - 可拖拽排序 */}
      {categories.map(category => (
        <div
          key={category.id}
          className={`category-tab ${activeCategory === category.id ? 'active' : ''} ${dragOverId === category.id ? 'drag-over' : ''}`}
          onClick={() => onCategoryChange(category.id)}
          onContextMenu={(e) => handleContextMenu(e, category.id)}
          draggable={editingId !== category.id}
          onDragStart={(e) => handleDragStart(e, category.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, category.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, category.id)}
        >
          {editingId === category.id ? (
            <input
              ref={editInputRef}
              type="text"
              className="category-edit-input"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit()
                if (e.key === 'Escape') setEditingId(null)
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="tab-label">{category.name}</span>
              <span className="count-badge">{getCategoryCount(category)}</span>
            </>
          )}
        </div>
      ))}

      {/* 添加分类按钮/输入框 */}
      {isAdding ? (
        <div className="category-tab adding">
          <input
            ref={inputRef}
            type="text"
            className="category-add-input"
            placeholder="输入名称"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onBlur={handleAddCategory}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCategory()
              if (e.key === 'Escape') {
                setIsAdding(false)
                setNewCategoryName('')
              }
            }}
          />
        </div>
      ) : (
        <button
          className="category-add-btn"
          onClick={() => setIsAdding(true)}
          title="添加分类"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      )}

      {/* 右键菜单 */}
      {contextMenu.open && (
        <div
          className="category-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="category-menu-item" onClick={handleStartEdit}>
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            编辑名称
          </div>
          <div className="category-menu-item danger" onClick={handleDeleteCategory}>
            <svg viewBox="0 0 24 24" width="14" height="14">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            删除分类
          </div>
        </div>
      )}
    </div>
  )
}

export default CategoryTabs
