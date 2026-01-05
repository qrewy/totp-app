import "../styles/add-button.css"

type Props = {
  onClick: () => void
}

export function AddButton({ onClick }: Props) {
  return (
    <button className="add-button" type="button" onClick={onClick}>
      <span className="add-icon" aria-hidden="true" />
    </button>
  )
}
