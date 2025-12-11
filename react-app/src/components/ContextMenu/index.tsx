import './ContextMenu.css'

interface ContextMenuProps {
  open: boolean
  x: number
  y: number
  onClose: () => void
  onSetAlert: () => void
  onSetCost: () => void
  onDelete: () => void
}

function ContextMenu({ open, x, y, onClose, onSetAlert, onSetCost, onDelete }: ContextMenuProps) {
  const menuWidth = 160
  const menuHeight = 120
  const maxX = window.innerWidth - menuWidth - 10
  const maxY = window.innerHeight - menuHeight - 10

  return (
    <div
      className={`context-menu ${open ? 'show' : ''}`}
      style={{
        left: Math.min(x, maxX),
        top: Math.min(y, maxY),
        display: open ? 'block' : 'none'
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="context-menu-item" onClick={() => { onSetAlert(); onClose() }}>
        设置价格预警
      </div>
      <div className="context-menu-item" onClick={() => { onSetCost(); onClose() }}>
        设置持仓成本
      </div>
      <div className="context-menu-item danger" onClick={() => { onDelete(); onClose() }}>
        删除此股票
      </div>
    </div>
  )
}

export default ContextMenu
