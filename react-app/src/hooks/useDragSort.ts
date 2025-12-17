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

  // 拖拽移动
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    const state = dragState.current
    if (!state.isDragging) return
    e.preventDefault()

    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY
    if (clientY !== undefined) {
      updatePositions(clientY)
    }
  }, [updatePositions])

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    const state = dragState.current
    if (!state.isDragging) return

    // 移除全局事件
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
    document.removeEventListener('touchmove', handleDragMove)
    document.removeEventListener('touchend', handleDragEnd)
    
    document.body.classList.remove('dragging') // 移除 body class

    const positionChanged = state.currentIndex !== state.initialIndex && state.currentIndex >= 0

    // 清理样式
    state.rows.forEach(row => {
      row.classList.remove('drag-shift-up', 'drag-shift-down', 'drag-source')
      row.style.transform = ''
    })

    // 如果位置改变了，触发回调
    if (positionChanged) {
      onReorder(state.initialIndex, state.currentIndex)
    }

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
  }, [handleDragMove, onReorder])

  // 拖拽开始
  const handleDragStart = useCallback((e: MouseEvent | TouchEvent, element: HTMLElement) => {
    const state = dragState.current
    if (state.isDragging || !containerRef.current) return

    // 检查是否从拖拽把手开始
    const target = e.target as HTMLElement
    const handle = target.closest(handleSelector)
    if (!handle) return

    e.preventDefault()

    const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY
    if (clientY === undefined) return

    const rows = Array.from(containerRef.current.querySelectorAll(itemSelector)) as HTMLElement[]
    const initialIndex = rows.indexOf(element)

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
    document.body.classList.add('dragging') // 添加 body class

    // 添加全局事件
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
    document.addEventListener('touchmove', handleDragMove, { passive: false })
    document.addEventListener('touchend', handleDragEnd)
  }, [containerRef, itemSelector, handleSelector, handleDragMove, handleDragEnd])

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
