import { useState, useEffect, useCallback } from 'react'
import FileEditorPanel from './FileEditorPanel.jsx'

const API = import.meta.env.VITE_API_URL || ''

const PROVIDERS = [
  { id: 'authelia',  label: 'Authelia' },
  { id: 'authentik', label: 'Authentik' },
  { id: 'ldap',      label: 'LDAP' },
  { id: 'tinyauth',  label: 'TinyAuth' },
]

const LEVEL_DESC = {
  server:   'Include in server block (subdomain proxy confs)',
  location: 'Include inside location blocks',
}

const STATUS = {
  active:   { text: 'Active',   dotClass: 'active',   badgeClass: 'badge-status-active' },
  disabled: { text: 'Disabled', dotClass: 'inactive', badgeClass: 'badge-status-disabled' },
  sample:   { text: 'Sample',   dotClass: 'inactive', badgeClass: 'badge-status-sample' },
  new:      { text: 'New',      dotClass: 'inactive', badgeClass: 'badge-status-new' },
}

export default function AuthConfigPage() {
  const [statuses, setStatuses]   = useState({})
  const [contents, setContents]   = useState({})
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(null)  // { provider, level }
  const [working, setWorking]     = useState({})    // { 'authelia-server': true }
  const [toast, setToast]         = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

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
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const setStatus = (provider, level, status) =>
    setStatuses(s => ({ ...s, [provider]: { ...(s[provider] ?? {}), [level]: status } }))

  const handleEnable = async (provider, level) => {
    const key = `${provider}-${level}`
    setWorking(w => ({ ...w, [key]: true }))
    try {
      const res = await fetch(`${API}/api/auth-configs/${provider}/${level}/enable`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      setStatus(provider, level, 'active')
      setContents(c => ({ ...c, [key]: data.content }))
      showToast(`${key}.conf enabled`)
    } finally {
      setWorking(w => ({ ...w, [key]: false }))
    }
  }

  const handleDisable = async (provider, level) => {
    const key = `${provider}-${level}`
    setWorking(w => ({ ...w, [key]: true }))
    try {
      const res = await fetch(`${API}/api/auth-configs/${provider}/${level}/disable`, { method: 'POST' })
      if (res.ok) {
        setStatus(provider, level, 'disabled')
        showToast(`${key}.conf disabled`)
      }
    } finally {
      setWorking(w => ({ ...w, [key]: false }))
    }
  }

  const handleSave = async (newContent) => {
    const { provider, level } = editing
    const res = await fetch(`${API}/api/auth-configs/${provider}/${level}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: newContent }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Save failed')
    }
    const key = `${provider}-${level}`
    setContents(c => ({ ...c, [key]: newContent }))
    // Saving always creates/updates .conf → mark active
    setStatus(provider, level, 'active')
    showToast(`${key}.conf saved`)
  }

  if (loading) return <div className="loading-state">Loading...</div>

  const cards = PROVIDERS.flatMap(p =>
    ['server', 'location'].map(l => ({
      provider:  p.id,
      label:     p.label,
      level:     l,
      key:       `${p.id}-${l}`,
      status:    statuses[p.id]?.[l] ?? 'new',
    }))
  )

  return (
    <>
      <div className="auth-proxy-reminder">
        <span className="auth-proxy-reminder-icon">ℹ</span>
        <span>
          Your auth provider's own proxy host must be <strong>enabled in Proxy Hosts</strong> for
          auth to work — e.g. <code>authelia.subdomain.conf</code>.
        </span>
      </div>

      <div className="host-grid">
        {cards.map(card => {
          const st      = STATUS[card.status] ?? STATUS.new
          const isActive = card.status === 'active'
          const busy    = working[card.key]

          return (
            <div key={card.key} className={`host-card ${!isActive ? 'disabled' : ''}`}>
              <div className="host-card-header">
                <div className="host-name-row">
                  <h3 className="host-name">{card.label}</h3>
                  <span className={`badge badge-level-${card.level}`}>{card.level}</span>
                  <span className={`badge ${st.badgeClass}`}>{st.text}</span>
                </div>
                <div className={`status-dot ${st.dotClass}`} title={st.text} />
              </div>

              <p className="conf-card-desc">{LEVEL_DESC[card.level]}</p>
              <p className="conf-card-filename">{card.key}.conf</p>

              <div className="host-actions">
                {!isActive && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleEnable(card.provider, card.level)}
                    disabled={busy}
                  >
                    Enable
                  </button>
                )}
                {isActive && (
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => handleDisable(card.provider, card.level)}
                    disabled={busy}
                  >
                    Disable
                  </button>
                )}
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setEditing({ provider: card.provider, level: card.level })}
                >
                  Edit
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <FileEditorPanel
          title={`${editing.provider}-${editing.level}.conf`}
          content={contents[`${editing.provider}-${editing.level}`] ?? ''}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
