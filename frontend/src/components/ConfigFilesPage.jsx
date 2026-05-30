import { useState, useEffect, useCallback } from 'react'
import FileEditorPanel from './FileEditorPanel.jsx'
import ConfirmModal from './ConfirmModal.jsx'

const API = import.meta.env.VITE_API_URL || ''

// Core files — apiGroup controls which backend route is used (default 'nginx-configs')
const CORE_FILES = [
  {
    id:          'nginx.conf',
    description: 'Main nginx configuration file',
    warning:     'Core file — changes affect the entire nginx process.',
  },
  {
    id:          'proxy.conf',
    description: 'Default proxy headers applied to every proxy host',
    warning:     'Changes here affect all proxy hosts.',
  },
  {
    id:          'resolver.conf',
    description: 'Upstream DNS resolver settings',
    warning:     'Changes here affect upstream DNS resolution.',
  },
  {
    id:          'ssl.conf',
    description: 'SSL/TLS settings shared by all hosts',
    warning:     'Changes here affect all SSL termination.',
  },
  {
    id:          'default.conf',
    apiGroup:    'site-confs',
    description: 'Default site configuration',
  },
]

// ── New custom config modal ───────────────────────────────────────────────────

function NewConfigModal({ onCreated, onClose }) {
  const [name, setName]         = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  const create = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/nginx-configs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filename: name }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.detail || 'Failed to create')
      } else {
        onCreated(await res.json())  // { filename, content }
      }
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  const finalName = name.endsWith('.conf') ? name : `${name}.conf`

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <header className="panel-header">
          <h2>New Config File</h2>
          <button className="close-btn" onClick={onClose} type="button">✕</button>
        </header>

        <div className="panel-form">
          <div className="form-group">
            <label>Filename</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) create() }}
              placeholder="e.g. custom-headers"
              autoFocus
            />
            {name && <span className="form-hint">{finalName} → /config/nginx</span>}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfigFilesPage({ onSave }) {
  const [contents, setContents]   = useState({})
  const [custom, setCustom]       = useState([])      // [{ filename }]
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(null)    // { id, apiGroup }
  const [newOpen, setNewOpen]     = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const result = {}

    // Core files
    for (const f of CORE_FILES) {
      const group = f.apiGroup ?? 'nginx-configs'
      try {
        const res = await fetch(`${API}/api/${group}/${f.id}`)
        result[f.id] = res.ok ? (await res.json()).content : null
      } catch {
        result[f.id] = null
      }
    }

    // Custom files
    let customList = []
    try {
      const res = await fetch(`${API}/api/nginx-configs`)
      if (res.ok) {
        const data = await res.json()
        customList = data.custom || []
        for (const c of customList) {
          try {
            const r = await fetch(`${API}/api/nginx-configs/${c.filename}`)
            result[c.filename] = r.ok ? (await r.json()).content : null
          } catch {
            result[c.filename] = null
          }
        }
      }
    } catch { /* ignore */ }

    setContents(result)
    setCustom(customList)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleSave = async (newContent) => {
    const { id, apiGroup } = editing
    const group = apiGroup ?? 'nginx-configs'
    const res = await fetch(`${API}/api/${group}/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: newContent }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Save failed')
    }
    setContents(c => ({ ...c, [id]: newContent }))
    onSave?.()
  }

  const handleCreated = (data) => {
    setNewOpen(false)
    setContents(c => ({ ...c, [data.filename]: data.content }))
    setCustom(list => list.some(f => f.filename === data.filename) ? list : [...list, { filename: data.filename }])
    setEditing({ id: data.filename })
  }

  const handleDelete = async () => {
    const res = await fetch(`${API}/api/nginx-configs/${deleteTarget}`, { method: 'DELETE' })
    if (res.ok) {
      setCustom(list => list.filter(f => f.filename !== deleteTarget))
      setContents(c => { const n = { ...c }; delete n[deleteTarget]; return n })
      onSave?.()
    }
    setDeleteTarget(null)
  }

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <>
      <div className="page-actions-bar">
        <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
          + Custom
        </button>
      </div>

      <div className="host-grid">
        {CORE_FILES.map(file => {
          const missing = contents[file.id] === null
          return (
            <div key={file.id} className={`host-card ${missing ? 'disabled' : ''}`}>
              <div className="host-card-header">
                <div className="host-name-row">
                  <h3 className="host-name">{file.id}</h3>
                </div>
                <div
                  className={`status-dot ${missing ? 'inactive' : 'active'}`}
                  title={missing ? 'File not found' : 'Active'}
                />
              </div>

              <p className="conf-card-desc">{file.description}</p>
              {file.warning && <p className="conf-card-warn">⚠ {file.warning}</p>}

              <div className="host-actions">
                {missing ? (
                  <span className="conf-card-missing">Not found — check /config/nginx mount</span>
                ) : (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setEditing({ id: file.id, apiGroup: file.apiGroup })}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {custom.map(file => (
          <div key={file.filename} className="host-card">
            <div className="host-card-header">
              <div className="host-name-row">
                <h3 className="host-name">{file.filename}</h3>
                <span className="badge badge-status-new">custom</span>
              </div>
              <div className="status-dot active" title="Active" />
            </div>

            <p className="conf-card-filename">/config/nginx/{file.filename}</p>

            <div className="host-actions">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setEditing({ id: file.filename })}
              >
                Edit
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => setDeleteTarget(file.filename)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {newOpen && (
        <NewConfigModal onCreated={handleCreated} onClose={() => setNewOpen(false)} />
      )}

      {editing && (
        <FileEditorPanel
          title={editing.id}
          content={contents[editing.id] ?? ''}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete config file"
          message={`Remove "${deleteTarget}" from /config/nginx? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}
