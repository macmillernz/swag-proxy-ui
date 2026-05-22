export default function ProxyHostList({ hosts, loading, onEdit, onToggle, onDelete }) {
  if (loading) {
    return <div className="loading-state">Loading proxy hosts...</div>
  }

  if (hosts.length === 0) {
    return (
      <div className="empty-state">
        <p>No proxy hosts configured yet.</p>
        <p>Click "Add Proxy Host" to create your first nginx reverse proxy.</p>
      </div>
    )
  }

  return (
    <div className="host-grid">
      {hosts.map(host => (
        <div key={host.name} className={`host-card ${host.enabled ? '' : 'disabled'}`}>
          <div className="host-card-header">
            <div className="host-name-row">
              <h3 className="host-name">{host.name}</h3>
              <span className={`badge badge-${host.type}`}>{host.type}</span>
              {!host.managed && <span className="badge badge-unmanaged">unmanaged</span>}
            </div>
            <div className={`status-dot ${host.enabled ? 'active' : 'inactive'}`} title={host.enabled ? 'Enabled' : 'Disabled'} />
          </div>

          {host.managed && (
            <div className="host-details">
              <span className="host-upstream">
                {host.upstream_proto}://{host.upstream_host}:{host.upstream_port}
              </span>
              {host.websocket && <span className="badge badge-ws">WS</span>}
            </div>
          )}

          <div className="host-actions">
            {host.managed && (
              <button className="btn btn-sm btn-ghost" onClick={() => onEdit(host)}>
                Edit
              </button>
            )}
            <button
              className={`btn btn-sm ${host.enabled ? 'btn-warning' : 'btn-success'}`}
              onClick={() => onToggle(host.name)}
            >
              {host.enabled ? 'Disable' : 'Enable'}
            </button>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(host.name)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
