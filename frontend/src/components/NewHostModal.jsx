import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || ''

export default function NewHostModal({ onCreated, onClose }) {
  const [name, setName]         = useState('')
  const [type, setType]         = useState('subdomain')
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState(null)

  const create = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/proxy-hosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.detail || 'Failed to create')
      } else {
        onCreated(await res.json())  // { name, type, content }
      }
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <header className="panel-header">
          <h2>New Proxy Host</h2>
          <button className="close-btn" onClick={onClose} type="button">✕</button>
        </header>

        <div className="panel-form">
          <div className="form-group">
            <label>Service Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) create() }}
              placeholder="e.g. sonarr"
              autoFocus
            />
            {name && (
              <span className="form-hint">{name}.{type}.conf</span>
            )}
          </div>

          <div className="form-group">
            <label>Proxy Type</label>
            <div className="radio-group">
              <label className="radio-option">
                <input type="radio" value="subdomain" checked={type === 'subdomain'} onChange={() => setType('subdomain')} />
                <span>Subdomain</span>
                <small>{name || 'app'}.example.com</small>
              </label>
              <label className="radio-option">
                <input type="radio" value="subfolder" checked={type === 'subfolder'} onChange={() => setType('subfolder')} />
                <span>Subfolder</span>
                <small>example.com/{name || 'app'}</small>
              </label>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="panel-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={create}
              disabled={!name.trim() || creating}
            >
              {creating ? 'Creating...' : 'Create & Edit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
