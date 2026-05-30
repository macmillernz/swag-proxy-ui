import { useState, useEffect, useCallback } from 'react'
import FileEditorPanel from './FileEditorPanel.jsx'

const API = import.meta.env.VITE_API_URL || ''

// ── Jail card ─────────────────────────────────────────────────────────────────

function JailCard({ jail, onUnban, onBan }) {
  const [banOpen, setBanOpen] = useState(false)
  const [banIp, setBanIp]     = useState('')
  const [busy, setBusy]       = useState(false)

  const doBan = async () => {
    if (!banIp.trim()) return
    setBusy(true)
    await onBan(jail.name, banIp.trim())
    setBusy(false)
    setBanIp('')
    setBanOpen(false)
  }

  return (
    <div className="host-card f2b-jail-card">
      <div className="host-card-header">
        <div className="host-name-row">
          <h3 className="host-name">{jail.name}</h3>
          {jail.currently_banned > 0 && (
            <span className="badge badge-status-banned">{jail.currently_banned} banned</span>
          )}
        </div>
        <div
          className={`status-dot ${jail.currently_banned > 0 ? 'banned' : 'active'}`}
          title={`${jail.currently_banned} currently banned`}
        />
      </div>

      <div className="f2b-stats">
        <span><b>{jail.currently_failed}</b> failed</span>
        <span className="f2b-stat-sep">·</span>
        <span><b>{jail.currently_banned}</b> banned</span>
        <span className="f2b-stat-sep">·</span>
        <span className="f2b-stat-muted">{jail.total_banned} total bans</span>
      </div>

      {jail.banned_ips.length > 0 && (
        <div className="f2b-banned-list">
          {jail.banned_ips.map(ip => (
            <div key={ip} className="f2b-banned-ip">
              <span className="f2b-ip">{ip}</span>
              <button
                className="btn btn-sm btn-warning"
                onClick={() => onUnban(jail.name, ip)}
              >
                Unban
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="host-actions">
        {banOpen ? (
          <div className="f2b-ban-row">
            <input
              type="text"
              className="search-input f2b-ban-input"
              value={banIp}
              onChange={e => setBanIp(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doBan() }}
              placeholder="IP to ban"
              autoFocus
            />
            <button className="btn btn-sm btn-danger" onClick={doBan} disabled={busy || !banIp.trim()}>
              {busy ? '...' : 'Ban'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setBanOpen(false); setBanIp('') }}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-sm btn-ghost" onClick={() => setBanOpen(true)}>
            + Ban IP
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Fail2banPage() {
  const [jails, setJails]       = useState([])
  const [configs, setConfigs]   = useState([])
  const [contents, setContents] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [editing, setEditing]   = useState(null)  // { filepath }
  const [toast, setToast]       = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const loadStatus = useCallback(async () => {
    const res = await fetch(`${API}/api/fail2ban/status`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Could not reach fail2ban')
    }
    const data = await res.json()
    setJails(data.jails || [])
  }, [])

  const loadConfigs = useCallback(async () => {
    const res = await fetch(`${API}/api/fail2ban-configs`)
    const data = res.ok ? await res.json() : { files: [] }
    const list = data.files || []
    const result = {}
    for (const f of list) {
      try {
        const r = await fetch(`${API}/api/fail2ban-configs/${encodeURIComponent(f.filepath)}`)
        result[f.filepath] = r.ok ? (await r.json()).content : null
      } catch {
        result[f.filepath] = null
      }
    }
    setConfigs(list)
    setContents(result)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await loadStatus()
      await loadConfigs()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [loadStatus, loadConfigs])

  useEffect(() => { loadAll() }, [loadAll])

  const handleUnban = async (jail, ip) => {
    const res = await fetch(`${API}/api/fail2ban/${jail}/unban`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ip }),
    })
    if (res.ok) {
      showToast(`Unbanned ${ip}`)
      try { await loadStatus() } catch { /* ignore */ }
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.detail || 'Unban failed', 'error')
    }
  }

  const handleBan = async (jail, ip) => {
    const res = await fetch(`${API}/api/fail2ban/${jail}/ban`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ip }),
    })
    if (res.ok) {
      showToast(`Banned ${ip}`)
      try { await loadStatus() } catch { /* ignore */ }
    } else {
      const err = await res.json().catch(() => ({}))
      showToast(err.detail || 'Ban failed', 'error')
    }
  }

  const handleSave = async (newContent) => {
    const { filepath } = editing
    const res = await fetch(`${API}/api/fail2ban-configs/${encodeURIComponent(filepath)}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: newContent }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Save failed')
    }
    setContents(c => ({ ...c, [filepath]: newContent }))
  }

  if (loading) return <div className="loading-state">Loading...</div>

  if (error) {
    return (
      <div className="error-state">
        <p>fail2ban is unavailable.</p>
        <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
          {error}
        </p>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }} onClick={loadAll}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="page-actions-bar">
        <button className="btn btn-ghost btn-sm" onClick={loadAll}>↺ Refresh</button>
      </div>

      <details className="f2b-help">
        <summary>How to protect another container with fail2ban</summary>
        <div className="f2b-help-body">
          <p>
            fail2ban runs <em>inside</em> SWAG, so it can only ban based on logs it can read.
            To watch another app's logs:
          </p>
          <ol>
            <li>
              <b>Give SWAG the app's log.</b> Bind-mount the app's log file into the SWAG
              container under <code>/config/log/&lt;app&gt;/</code> (e.g. add
              <code> - /opt/appdata/&lt;app&gt;/log:/config/log/&lt;app&gt;</code> to SWAG's
              <code> volumes</code>).
            </li>
            <li>
              <b>Add a filter.</b> Create <code>filter.d/&lt;app&gt;.conf</code> (Config section
              below) with a <code>failregex</code> that matches the app's failed-login lines.
            </li>
            <li>
              <b>Add a jail</b> to <code>jail.local</code>:
              <pre>{`[<app>]
enabled  = true
filter   = <app>
logpath  = /config/log/<app>/app.log
maxretry = 5
bantime  = 1h`}</pre>
            </li>
            <li>
              <b>Reload</b> — restart the SWAG container (or run
              <code> fail2ban-client reload</code>), then hit <b>Refresh</b> here.
            </li>
          </ol>
          <p className="f2b-help-note">
            Bans are enforced at SWAG's firewall, so the app's traffic must pass through SWAG's
            reverse proxy for a ban to take effect.
          </p>
        </div>
      </details>

      <h2 className="f2b-section-title">Jails</h2>
      {jails.length === 0 ? (
        <div className="empty-state"><p>No active jails.</p></div>
      ) : (
        <div className="host-grid">
          {jails.map(jail => (
            <JailCard key={jail.name} jail={jail} onUnban={handleUnban} onBan={handleBan} />
          ))}
        </div>
      )}

      <h2 className="f2b-section-title" style={{ marginTop: '2rem' }}>Config</h2>
      {configs.length === 0 ? (
        <div className="empty-state"><p>No config files found in /config/fail2ban.</p></div>
      ) : (
        <div className="host-grid">
          {configs.map(file => {
            const missing = contents[file.filepath] === null
            return (
              <div key={file.filepath} className={`host-card ${missing ? 'disabled' : ''}`}>
                <div className="host-card-header">
                  <div className="host-name-row">
                    <h3 className="host-name">{file.filepath}</h3>
                  </div>
                  <div className={`status-dot ${missing ? 'inactive' : 'active'}`} />
                </div>
                <div className="host-actions">
                  {missing ? (
                    <span className="conf-card-missing">Not readable</span>
                  ) : (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setEditing({ filepath: file.filepath })}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <FileEditorPanel
          title={editing.filepath}
          content={contents[editing.filepath] ?? ''}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </>
  )
}
