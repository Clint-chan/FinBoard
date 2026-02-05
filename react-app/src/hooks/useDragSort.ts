/**
 * useDragSort - 拖拽排序 Hook
 * 支持鼠标和触摸操作
 */
import { useRef, useCallback, useEffect } from 'react'

interface DragState {
  isDragging: boolean
  draggedElement: HTMLElement | null
  initialIndex: number
  currentIndex: number
  startY: number
  rowHeight: number
  rows: HTMLElement[]
}

interface UseDragSortOptions {
  containerRef: React.RefObject<HTMLElement>
  itemSelector: string
  handleSelector?: string
  onReorder: (fromIndex: number, toIndex: number) => void
}

export function useDragSort({
  containerRef,
  itemSelector,
  handleSelector = '.drag-handle',
  onReorder
}: UseDragSortOptions) {
  const dragState = useRef<DragState>({
    isDragging: false,
    draggedElement: null,
    initialIndex: -1,
    currentIndex: -1,
    startY: 0,
    rowHeight: 0,
    rows: []
  })

  // 更新位置
  const updatePositions = useCallback((mouseY: number) => {
    const state = dragState.current
    if (!state.draggedElement || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const relativeY = mouseY - containerRect.top
    const newIndex = Math.max(0, Math.min(state.rows.length - 1, Math.floor(relativeY / state.rowHeight)))

    // 更新被拖行的位移
    const dragOffset = mouseY - state.startY
    state.draggedElement.style.transform = `translateY(${dragOffset}px)`

    if (newIndex !== state.currentIndex) {
      state.currentIndex = newIndex

      state.rows.forEach((row) => {
        if (row === state.draggedElement) return

        row.classList.remove('drag-shift-up', 'drag-shift-down')

        const rowIdx = state.rows.indexOf(row)
        if (state.initialIndex < state.currentIndex) {
          // 向下拖
          if (rowIdx > state.initialIndex && rowIdx <= state.currentIndex) {
            row.classList.add('drag-shift-up')
          }
        } else {
          // 向上拖
          if (rowIdx >= state.currentIndex && rowIdx < state.initialIndex) {
            row.classList.add('drag-shift-down')
          }
        }
      })
    }
  }, [containerRef])

  // 使用 useRef 存储回调函数，避免循环依赖
  const handleDragMoveRef = useRef<(e: MouseEvent | TouchEvent) => void>()
  const handleDragEndRef = useRef<(e?: MouseEvent | TouchEvent) => void>()

  // 拖拽移动
  handleDragMoveRef.current = useCallback((e: MouseEvent | TouchEvent) => {
    const state = dragState.current
    if (!state.isDragging) return
    e.preventDefault()
    e.stopPropagation()

    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY
    if (clientY !== undefined) {
      updatePositions(clientY)
    }
  }, [updatePositions])

  // 拖拽结束
  handleDragEndRef.current = useCallback((e?: MouseEvent | TouchEvent) => {
    const state = dragState.current
    if (!state.isDragging) return

    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    const positionChanged = state.currentIndex !== state.initialIndex && state.currentIndex >= 0

    // 清理样式
    state.rows.forEach(row => {
      row.classList.remove('drag-shift-up', 'drag-shift-down', 'drag-source')
      row.style.transform = ''
    })
    
    document.body.classList.remove('dragging')

    // 保存索引
    const fromIndex = state.initialIndex
    const toIndex = state.currentIndex
    
    // 重置状态
    dragState.current = {
      isDragging: false,
      draggedElement: null,
      initialIndex: -1,
      currentIndex: -1,
      startY: 0,
      rowHeight: 0,
      rows: []
    }

    // 移除全局事件
    const moveHandler = handleDragMoveRef.current
    const endHandler = handleDragEndRef.current
    if (moveHandler && endHandler) {
      document.removeEventListener('mousemove', moveHandler as any)
      document.removeEventListener('mouseup', endHandler as any)
      document.removeEventListener('touchmove', moveHandler as any)
      document.removeEventListener('touchend', endHandler as any)
      document.removeEventListener('mouseleave', endHandler as any)
    }

    // 如果位置改变了，触发回调
    if (positionChanged) {
      onReorder(fromIndex, toIndex)
    }
  }, [onReorder])

  // 拖拽开始
  const handleDragStart = useCallback((e: MouseEvent | TouchEvent, element: HTMLElement) => {
    const state = dragState.current
    if (state.isDragging || !containerRef.current) return

    // 检查是否从拖拽把手开始
    const target = e.target as HTMLElement
    const handle = target.closest(handleSelector)
    if (!handle) return

    e.preventDefault()
    e.stopPropagation()

    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY
    if (clientY === undefined) return

    const rows = Array.from(containerRef.current.querySelectorAll(itemSelector)) as HTMLElement[]
    const initialIndex = rows.indexOf(element)
    
    if (initialIndex === -1) return

    dragState.current = {
      isDragging: true,
      draggedElement: element,
      initialIndex,
      currentIndex: initialIndex,
      startY: clientY,
      rowHeight: element.offsetHeight,
      rows
    }

    element.classList.add('drag-source')
    document.body.classList.add('dragging')

    // 添加全局事件
    const moveHandler = handleDragMoveRef.current
    const endHandler = handleDragEndRef.current
    if (moveHandler && endHandler) {
      document.addEventListener('mousemove', moveHandler as any, { passive: false })
      document.addEventListener('mouseup', endHandler as any, { passive: false })
      document.addEventListener('touchmove', moveHandler as any, { passive: false })
      document.addEventListener('touchend', endHandler as any, { passive: false })
      document.addEventListener('mouseleave', endHandler as any, { passive: false })
    }
  }, [containerRef, itemSelector, handleSelector])

  // 绑定容器事件
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseDown = (e: MouseEvent) => {
      const element = (e.target as HTMLElement).closest(itemSelector) as HTMLElement
      if (element) handleDragStart(e, element)
    }

    const handleTouchStart = (e: TouchEvent) => {
      const element = (e.target as HTMLElement).closest(itemSelector) as HTMLElement
      if (element) handleDragStart(e, element)
    }

    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('touchstart', handleTouchStart, { passive: false })

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('touchstart', handleTouchStart)
    }
  }, [containerRef, itemSelector, handleDragStart])

  return {
    isDragging: dragState.current.isDragging
  }
}

export default useDragSort
