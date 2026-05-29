import { useState, useEffect, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { themeBase, nginxExtensions } from '../lib/nginxEditor.js'

const API = import.meta.env.VITE_API_URL || ''

const PROVIDERS = [
  { id: 'authelia',  label: 'Authelia' },
  { id: 'authentik', label: 'Authentik' },
  { id: 'ldap',      label: 'LDAP' },
  { id: 'tinyauth',  label: 'TinyAuth' },
]

const STATUS_LABELS = {
  active: { text: 'Active',          color: 'var(--success)' },
  sample: { text: 'Sample available', color: 'var(--warning)' },
  new:    { text: 'New file',         color: 'var(--accent)' },
}

export default function AuthConfigPage() {
  const [provider, setProvider]   = useState('authelia')
  const [level, setLevel]         = useState('server')
  const [statuses, setStatuses]   = useState({})     // { authelia: {server:'active', location:'new'}, … }
  const [contents, setContents]   = useState({})     // { 'authelia-server': '…', … }
  const [saved, setSaved]         = useState({})
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [toast, setToast]         = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // ── Load statuses + contents for all providers ──────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const statusRes = await fetch(`${API}/api/auth-configs`)
      const statusData = statusRes.ok ? await statusRes.json() : {}
      setStatuses(statusData)

      const result = {}
      for (const p of PROVIDERS) {
        for (const l of ['server', 'location']) {
          const key = `${p.id}-${l}`
          try {
            const res = await fetch(`${API}/api/auth-configs/${p.id}/${l}`)
            result[key] = res.ok ? (await res.json()).content : null
          } catch {
            result[key] = null
          }
        }
      }
      setContents(result)
      setSaved(result)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const key     = `${provider}-${level}`
  const isDirty = (k) => contents[k] !== saved[k]
  const status  = statuses[provider]?.[level] ?? 'new'

  const handleChange = useCallback((val) => {
    setContents(c => ({ ...c, [key]: val }))
    setError(null)
  }, [key])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/auth-configs/${provider}/${level}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contents[key] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.detail || 'Save failed')
      } else {
        setSaved(s => ({ ...s, [key]: contents[key] }))
        // Update status to active after saving
        setStatuses(s => ({
          ...s,
          [provider]: { ...(s[provider] ?? {}), [level]: 'active' },
        }))
        showToast(`${provider}-${level}.conf saved`)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  // Dot colour for provider tab — highest priority status
  const providerDot = (pid) => {
    const ps = statuses[pid]
    if (!ps) return null
    if (ps.server === 'active' || ps.location === 'active') return 'var(--success)'
    if (ps.server === 'sample' || ps.location === 'sample') return 'var(--warning)'
    return null
  }

  const filename = `${provider}-${level}.conf`

  return (
    <div className="auth-page">
      {/* ── Proxy host reminder ── */}
      <div className="auth-proxy-reminder">
        <span className="auth-proxy-reminder-icon">ℹ</span>
        <span>
          The <strong>{PROVIDERS.find(p => p.id === provider)?.label}</strong> proxy host must also be
          enabled in <strong>Proxy Hosts</strong> for auth to work
          — e.g. <code>{provider}.subdomain.conf</code>.
        </span>
      </div>

      {/* ── Provider tabs ── */}
      <div className="auth-provider-tabs">
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            className={`auth-provider-tab ${provider === p.id ? 'active' : ''}`}
            onClick={() => setProvider(p.id)}
          >
            {p.label}
            {providerDot(p.id) && (
              <span className="provider-dot" style={{ background: providerDot(p.id) }} />
            )}
          </button>
        ))}
      </div>

      <div className="auth-editor-area">
        {/* ── Level sub-tabs + status ── */}
        <div className="auth-level-header">
          <div className="auth-level-tabs">
            {['server', 'location'].map(l => (
              <button
                key={l}
                className={`auth-level-tab ${level === l ? 'active' : ''}`}
                onClick={() => setLevel(l)}
              >
                {l}.conf
                {isDirty(`${provider}-${l}`) && <span className="dirty-dot" />}
              </button>
            ))}
          </div>
          <span
            className="auth-status-badge"
            style={{ color: STATUS_LABELS[status]?.color }}
          >
            {STATUS_LABELS[status]?.text}
          </span>
        </div>

        {/* ── Status notice ── */}
        {status === 'sample' && (
          <div className="auth-notice auth-notice-sample">
            Showing <strong>{filename}.sample</strong> — save to create the active conf file at <code>/config/nginx/{filename}</code>
          </div>
        )}
        {status === 'new' && (
          <div className="auth-notice auth-notice-new">
            Pre-filled with the SWAG default template — save to create <code>/config/nginx/{filename}</code>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : contents[key] === null ? (
          <div className="conf-missing">
            <p>Could not load <strong>{filename}</strong>.</p>
            <p>Make sure <code>/config/nginx</code> is mounted correctly.</p>
          </div>
        ) : (
          <>
            <div className="cm-wrapper">
              <CodeMirror
                value={contents[key] ?? ''}
                onChange={handleChange}
                theme={themeBase}
                extensions={nginxExtensions}
                height="100%"
                basicSetup={{
                  lineNumbers:               true,
                  highlightActiveLine:       true,
                  highlightActiveLineGutter: true,
                  foldGutter:                false,
                  autocompletion:            false,
                  closeBrackets:             false,
                  searchKeymap:              true,
                }}
              />
            </div>

            <div className="conf-actions">
              {error && <span className="form-error" style={{ flex: 1 }}>{error}</span>}
              <span className="conf-status">{isDirty(key) ? 'Unsaved changes' : 'Saved'}</span>
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={saving || !isDirty(key)}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
