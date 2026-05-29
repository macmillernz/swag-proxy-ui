import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import ProxyHostList from './components/ProxyHostList.jsx'
import ProxyHostForm from './components/ProxyHostForm.jsx'
import ConfirmModal from './components/ConfirmModal.jsx'

const ConfigEditor   = lazy(() => import('./components/ConfigEditor.jsx'))
const AuthConfigPage = lazy(() => import('./components/AuthConfigPage.jsx'))

const API = import.meta.env.VITE_API_URL || ''

export default function App() {
  const [page, setPage] = useState('proxy-hosts')

  // Proxy hosts state
  const [hosts, setHosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [warning, setWarning] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingHost, setEditingHost] = useState(null)
  const [rawConf, setRawConf] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pendingReload, setPendingReload] = useState(false)
  const [toast, setToast] = useState(null)

  // Reload state
  const [reloading, setReloading] = useState(false)
  const [reloadError, setReloadError] = useState(null)

  // Config editor dirty state
  const [configDirty, setConfigDirty] = useState(false)

  // Health / container name
  const [swagContainer, setSwagContainer] = useState('swag')

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    fetch(`${API}/api/health`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.swag_container && setSwagContainer(d.swag_container))
      .catch(() => {})
  }, [])

  const fetchHosts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/proxy-hosts`)
      if (!res.ok) throw new Error()
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
    setPendingReload(true)
    showToast(isEdit ? 'Proxy host updated' : 'Proxy host created')
  }

  const handleToggle = async (name) => {
    const res = await fetch(`${API}/api/proxy-hosts/${name}/toggle`, { method: 'POST' })
    if (res.ok) {
      await fetchHosts()
      setPendingReload(true)
      showToast('Status updated')
    }
  }

  const handleDelete = async () => {
    const res = await fetch(`${API}/api/proxy-hosts/${deleteTarget}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchHosts()
      setDeleteTarget(null)
      setPendingReload(true)
      showToast('Proxy host deleted')
    }
  }

  const openEdit = async (host) => {
    if (!host.managed) return
    const res = await fetch(`${API}/api/proxy-hosts/${host.name}`)
    if (res.ok) {
      setEditingHost(await res.json())
      setRawConf(null)
      setFormOpen(true)
    }
  }

  const openOnboard = async (host) => {
    const res = await fetch(`${API}/api/proxy-hosts/${host.name}/parse`)
    if (res.ok) {
      const data = await res.json()
      const { raw_conf, ...parsed } = data
      setEditingHost(parsed)
      setRawConf(raw_conf)
      setFormOpen(true)
    }
  }

  const handleReload = async () => {
    setReloading(true)
    setReloadError(null)
    try {
      const res = await fetch(`${API}/api/nginx/reload`, { method: 'POST' })
      if (res.ok) {
        setPendingReload(false)
        setConfigDirty(false)
        showToast('nginx reloaded ✓')
      } else {
        const err = await res.json().catch(() => ({}))
        setReloadError(err.detail || 'Reload failed')
      }
    } catch {
      setReloadError('Could not reach backend')
    } finally {
      setReloading(false)
    }
  }

  const enabledCount = hosts.filter(h => h.enabled).length
  const needsReload = pendingReload || configDirty

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
              <button
                className={`nav-item ${page === 'proxy-hosts' ? 'active' : ''}`}
                onClick={() => setPage('proxy-hosts')}
              >
                <span className="nav-icon">⇄</span>
                Proxy Hosts
                {hosts.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text3)' }}>
                    {enabledCount}/{hosts.length}
                  </span>
                )}
              </button>
            </li>
            <li>
              <button
                className={`nav-item ${page === 'config-files' ? 'active' : ''}`}
                onClick={() => setPage('config-files')}
              >
                <span className="nav-icon">✎</span>
                Config Files
                {configDirty && <span className="nav-dirty-dot" />}
              </button>
            </li>
            <li>
              <button
                className={`nav-item ${page === 'auth-config' ? 'active' : ''}`}
                onClick={() => setPage('auth-config')}
              >
                <span className="nav-icon">🔒</span>
                Auth Config
              </button>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          {reloadError && (
            <div className="reload-error-msg">{reloadError}</div>
          )}
          <button
            className={`btn reload-btn ${needsReload ? 'btn-primary' : 'btn-ghost'} ${reloading ? 'loading' : ''}`}
            onClick={handleReload}
            disabled={reloading}
            title={`docker exec ${swagContainer} nginx -s reload`}
          >
            <span className={`reload-icon ${reloading ? 'spinning' : ''}`}>↺</span>
            {reloading ? 'Reloading...' : 'Reload nginx'}
          </button>
          <span className="sidebar-container-hint">{swagContainer}</span>
        </div>
      </aside>

      <main className="main-content">
        {page === 'proxy-hosts' && (
          <>
            <header className="page-header">
              <div>
                <h1 className="page-title">Proxy Hosts</h1>
                <p className="page-subtitle">Manage nginx reverse proxy configurations</p>
              </div>
              <button className="btn btn-primary" onClick={() => { setEditingHost(null); setRawConf(null); setFormOpen(true) }}>
                + Add Proxy Host
              </button>
            </header>

            {warning && <div className="warning-banner">{warning}</div>}

            {error ? (
              <div className="error-state">{error}</div>
            ) : (
              <ProxyHostList
                hosts={hosts}
                loading={loading}
                onEdit={openEdit}
                onOnboard={openOnboard}
                onToggle={handleToggle}
                onDelete={name => setDeleteTarget(name)}
              />
            )}
          </>
        )}

        {page === 'config-files' && (
          <>
            <header className="page-header">
              <div>
                <h1 className="page-title">Config Files</h1>
                <p className="page-subtitle">Edit nginx.conf, proxy.conf, resolver.conf and ssl.conf</p>
              </div>
            </header>
            <Suspense fallback={<div className="loading-state">Loading editor...</div>}>
              <ConfigEditor onDirty={setConfigDirty} />
            </Suspense>
          </>
        )}

        {page === 'auth-config' && (
          <>
            <header className="page-header">
              <div>
                <h1 className="page-title">Auth Config</h1>
                <p className="page-subtitle">Configure Authelia, Authentik, LDAP and TinyAuth snippets</p>
              </div>
            </header>
            <Suspense fallback={<div className="loading-state">Loading editor...</div>}>
              <AuthConfigPage />
            </Suspense>
          </>
        )}
      </main>

      {formOpen && (
        <ProxyHostForm
          initial={editingHost}
          rawConf={rawConf}
          onSave={handleSave}
          onClose={() => { setFormOpen(false); setEditingHost(null); setRawConf(null) }}
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
