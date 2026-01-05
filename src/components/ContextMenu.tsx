type MenuItem = {
  id: string
  label: string
  danger?: boolean
  onClick: () => void
}

type Props = {
  isOpen: boolean
  x: number
  y: number
  items: MenuItem[]
}

export function ContextMenu({ isOpen, x, y, items }: Props) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="context-menu"
      role="menu"
      style={{ left: x, top: y }}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`context-item ${item.danger ? "is-danger" : ""}`}
          role="menuitem"
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
