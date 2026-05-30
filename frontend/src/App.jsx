import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import ProxyHostList from './components/ProxyHostList.jsx'
import ConfirmModal from './components/ConfirmModal.jsx'
import NewHostModal from './components/NewHostModal.jsx'

// Lazy-load everything that pulls in the CodeMirror bundle
const ProxyHostEditor  = lazy(() => import('./components/ProxyHostEditor.jsx'))
const ConfigFilesPage  = lazy(() => import('./components/ConfigFilesPage.jsx'))
const AuthConfigPage   = lazy(() => import('./components/AuthConfigPage.jsx'))
const DnsConfigPage    = lazy(() => import('./components/DnsConfigPage.jsx'))
const Fail2banPage     = lazy(() => import('./components/Fail2banPage.jsx'))
const LogsPage         = lazy(() => import('./components/LogsPage.jsx'))

const API = import.meta.env.VITE_API_URL || ''

export default function App() {
  const [page, setPage] = useState('proxy-hosts')

  // Proxy hosts state
  const [hosts, setHosts]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [warning, setWarning]       = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pendingReload, setPendingReload] = useState(false)
  const [toast, setToast]           = useState(null)

  // Editor state: null | { name, content }
  const [editorHost, setEditorHost] = useState(null)
  const [newHostOpen, setNewHostOpen] = useState(false)

  // Search
  const [search, setSearch] = useState('')

  // Reload
  const [reloading, setReloading]   = useState(false)
  const [reloadError, setReloadError] = useState(null)

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

  // ── Open editor for an existing host ──────────────────────────────────────

  const openEdit = async (host) => {
    try {
      const res = await fetch(`${API}/api/proxy-hosts/${host.name}/content`)
      if (!res.ok) return
      const data = await res.json()
      setEditorHost({ name: host.name, content: data.content })
    } catch {}
  }

  // ── Enable a sample file (copy → .conf then open editor) ──────────────────

  const handleEnableSample = async (host) => {
    try {
      const res = await fetch(`${API}/api/proxy-hosts/${host.name}/enable-sample`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      await fetchHosts()
      setEditorHost({ name: host.name, content: data.content })
      showToast(`${host.name} enabled — fill in your upstream details and save`)
    } catch {}
  }

  // ── New host created from modal ────────────────────────────────────────────

  const handleNewHostCreated = async (data) => {
    setNewHostOpen(false)
    await fetchHosts()
    setEditorHost({ name: data.name, content: data.content })
  }

  // ── After saving in the editor ─────────────────────────────────────────────

  const handleEditorSave = () => {
    setPendingReload(true)
    showToast(`${editorHost.name} saved`)
  }

  // ── Toggle enable/disable ──────────────────────────────────────────────────

  const handleToggle = async (name) => {
    const res = await fetch(`${API}/api/proxy-hosts/${name}/toggle`, { method: 'POST' })
    if (res.ok) {
      await fetchHosts()
      setPendingReload(true)
      showToast('Status updated')
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    const res = await fetch(`${API}/api/proxy-hosts/${deleteTarget}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchHosts()
      setDeleteTarget(null)
      setPendingReload(true)
      showToast('Proxy host deleted')
    }
  }

  // ── Nginx reload ───────────────────────────────────────────────────────────

  const handleReload = async () => {
    setReloading(true)
    setReloadError(null)
    try {
      const res = await fetch(`${API}/api/nginx/reload`, { method: 'POST' })
      if (res.ok) {
        setPendingReload(false)
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

  const enabledCount = hosts.filter(h => h.enabled && !h.is_sample).length
  const needsReload  = pendingReload

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
                    {enabledCount}/{hosts.filter(h => !h.is_sample).length}
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
              </button>
            </li>
            <li>
              <button
                className={`nav-item ${page === 'auth-config' ? 'active' : ''}`}
                onClick={() => setPage('auth-config')}
              >
                <span className="nav-icon">⚿</span>
                Auth Config
              </button>
            </li>
            <li>
              <button
                className={`nav-item ${page === 'dns-config' ? 'active' : ''}`}
                onClick={() => setPage('dns-config')}
              >
                <span className="nav-icon">◎</span>
                DNS Config
              </button>
            </li>
            <li>
              <button
                className={`nav-item ${page === 'fail2ban' ? 'active' : ''}`}
                onClick={() => setPage('fail2ban')}
              >
                <span className="nav-icon">⛨</span>
                Fail2ban
              </button>
            </li>
            <li>
              <button
                className={`nav-item ${page === 'logs' ? 'active' : ''}`}
                onClick={() => setPage('logs')}
              >
                <span className="nav-icon">≡</span>
                Logs
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
              <div className="page-header-actions">
                <div className="search-wrap">
                  <input
                    type="search"
                    className="search-input"
                    placeholder="Search…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      className="search-clear"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                    >✕</button>
                  )}
                </div>
                <button className="btn btn-primary" onClick={() => setNewHostOpen(true)}>
                  + Custom
                </button>
              </div>
            </header>

            {warning && <div className="warning-banner">{warning}</div>}

            {error ? (
              <div className="error-state">{error}</div>
            ) : (
              <ProxyHostList
                hosts={search ? hosts.filter(h => h.name.toLowerCase().includes(search.toLowerCase())) : hosts}
                loading={loading}
                onEdit={openEdit}
                onToggle={handleToggle}
                onDelete={name => setDeleteTarget(name)}
                onEnableSample={handleEnableSample}
              />
            )}
          </>
        )}

        {page === 'config-files' && (
          <>
            <header className="page-header">
              <div>
                <h1 className="page-title">Config Files</h1>
                <p className="page-subtitle">Edit core nginx configuration files</p>
              </div>
            </header>
            <Suspense fallback={<div className="loading-state">Loading...</div>}>
              <ConfigFilesPage onSave={() => setPendingReload(true)} />
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

        {page === 'dns-config' && (
          <>
            <header className="page-header">
              <div>
                <h1 className="page-title">DNS Config</h1>
                <p className="page-subtitle">Edit DNS provider credential files for ACME DNS challenge</p>
              </div>
            </header>
            <Suspense fallback={<div className="loading-state">Loading...</div>}>
              <DnsConfigPage />
            </Suspense>
          </>
        )}

        {page === 'fail2ban' && (
          <>
            <header className="page-header">
              <div>
                <h1 className="page-title">Fail2ban</h1>
                <p className="page-subtitle">View jails, manage bans and edit fail2ban config</p>
              </div>
            </header>
            <Suspense fallback={<div className="loading-state">Loading...</div>}>
              <Fail2banPage />
            </Suspense>
          </>
        )}

        {page === 'logs' && (
          <>
            <header className="page-header">
              <div>
                <h1 className="page-title">Logs</h1>
                <p className="page-subtitle">View log files from /config/log</p>
              </div>
            </header>
            <Suspense fallback={<div className="loading-state">Loading...</div>}>
              <LogsPage />
            </Suspense>
          </>
        )}

      </main>

      {newHostOpen && (
        <NewHostModal
          onCreated={handleNewHostCreated}
          onClose={() => setNewHostOpen(false)}
        />
      )}

      {editorHost && (
        <Suspense fallback={null}>
          <ProxyHostEditor
            name={editorHost.name}
            content={editorHost.content}
            onSave={handleEditorSave}
            onClose={() => setEditorHost(null)}
          />
        </Suspense>
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
