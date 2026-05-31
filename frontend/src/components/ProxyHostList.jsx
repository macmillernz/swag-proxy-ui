export default function ProxyHostList({ hosts, loading, onEdit, onToggle, onDelete, onEnableSample }) {
  if (loading) {
    return <div className="loading-state">Loading proxy hosts...</div>
  }

  if (hosts.length === 0) {
    return (
      <div className="empty-state">
        <p>No proxy hosts configured yet.</p>
        <p>Click <strong>+ Custom</strong> to create one, or drop a .conf file into the proxy-confs directory.</p>
      </div>
    )
  }

  // Enabled → disabled → samples (alphabetical within each group)
  const sorted = [...hosts].sort((a, b) => {
    const rank = h => h.is_sample ? 2 : h.enabled ? 0 : 1
    const dr = rank(a) - rank(b)
    if (dr !== 0) return dr
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="host-grid">
      {sorted.map(host => (
        <div
          key={`${host.name}-${host.type}`}
          className={`host-card ${!host.enabled ? 'disabled' : ''} ${host.is_sample ? 'sample' : ''}`}
        >
          <div className="host-card-header">
            <div className="host-name-row">
              <h3 className="host-name">{host.name}</h3>
              <span className={`badge badge-${host.type}`}>{host.type}</span>
              {host.is_sample && <span className="badge badge-sample">sample</span>}
            </div>
            <div
              className={`status-dot ${host.enabled && !host.is_sample ? 'active' : 'inactive'}`}
              title={host.is_sample ? 'Sample — not active' : host.enabled ? 'Enabled' : 'Disabled'}
            />
          </div>

          <div className="host-actions">
            {host.is_sample ? (
              <button className="btn btn-sm btn-success" onClick={() => onEnableSample(host)}>
                Enable
              </button>
            ) : (
              <button className="btn btn-sm btn-warning" onClick={() => onToggle(host.name)}>
                Disable
              </button>
            )}
            <button className="btn btn-sm btn-ghost" onClick={() => onEdit(host)}>Edit</button>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(host.name)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
