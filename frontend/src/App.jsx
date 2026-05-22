import { useState, useEffect, useCallback } from 'react'
import ProxyHostList from './components/ProxyHostList.jsx'
import ProxyHostForm from './components/ProxyHostForm.jsx'
import ConfirmModal from './components/ConfirmModal.jsx'

const API = import.meta.env.VITE_API_URL || ''

export default function App() {
  const [hosts, setHosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [warning, setWarning] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingHost, setEditingHost] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [reloadNeeded, setReloadNeeded] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchHosts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/proxy-hosts`)
      if (!res.ok) throw new Error('Backend error')
      const data = await res.json()
      setHosts(data.hosts || [])
      setWarning(data.warning || null)
      setError(null)
    } catch {
      setError('Could not connect to backend. Is it running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchHosts() }, [fetchHosts])

  const handleSave = async (host) => {
    const isEdit = !!editingHost
    const url = isEdit ? `${API}/api/proxy-hosts/${editingHost.name}` : `${API}/api/proxy-hosts`
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(host),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Save failed')
    }
    await fetchHosts()
    setFormOpen(false)
    setEditingHost(null)
    setReloadNeeded(true)
    showToast(isEdit ? 'Proxy host updated' : 'Proxy host created')
  }

  const handleToggle = async (name) => {
    const res = await fetch(`${API}/api/proxy-hosts/${name}/toggle`, { method: 'POST' })
    if (res.ok) {
      await fetchHosts()
      setReloadNeeded(true)
      showToast('Status updated')
    }
  }

  const handleDelete = async () => {
    const res = await fetch(`${API}/api/proxy-hosts/${deleteTarget}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchHosts()
      setDeleteTarget(null)
      setReloadNeeded(true)
      showToast('Proxy host deleted')
    }
  }

  const openEdit = async (host) => {
    if (!host.managed) return
    const res = await fetch(`${API}/api/proxy-hosts/${host.name}`)
    if (res.ok) {
      setEditingHost(await res.json())
      setFormOpen(true)
    }
  }

  const enabledCount = hosts.filter(h => h.enabled).length

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-name">SWAG UI</span>
        </div>
        <nav>
          <ul className="nav-list">
            <li>
              <button className="nav-item active">
                <span className="nav-icon">⇄</span>
                Proxy Hosts
                {hosts.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text3)' }}>
                    {enabledCount}/{hosts.length}
                  </span>
                )}
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">Proxy Hosts</h1>
            <p className="page-subtitle">Manage nginx reverse proxy configurations</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditingHost(null); setFormOpen(true) }}>
            + Add Proxy Host
          </button>
        </header>

        {reloadNeeded && (
          <div className="reload-banner">
            <span>Changes saved — reload nginx to apply:</span>
            <code>docker exec swag nginx -s reload</code>
            <button className="dismiss-btn" onClick={() => setReloadNeeded(false)} type="button">✕</button>
          </div>
        )}

        {warning && <div className="warning-banner">{warning}</div>}

        {error ? (
          <div className="error-state">{error}</div>
        ) : (
          <ProxyHostList
            hosts={hosts}
            loading={loading}
            onEdit={openEdit}
            onToggle={handleToggle}
            onDelete={name => setDeleteTarget(name)}
          />
        )}
      </main>

      {formOpen && (
        <ProxyHostForm
          initial={editingHost}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditingHost(null) }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete proxy host"
          message={`Remove "${deleteTarget}" and its .conf file? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
