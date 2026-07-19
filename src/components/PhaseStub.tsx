import './PhaseStub.css'

// Temporary placeholder used while later phases build out each tab.
export function PhaseStub({ title, note }: { title: string; note: string }) {
  return (
    <div className="screen">
      <div className="screen-title stub-title">{title}</div>
      <div className="card stub-card">
        <div className="stub-note">{note}</div>
      </div>
    </div>
  )
}
