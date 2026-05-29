import { useState, useEffect, useCallback } from 'react'
import FileEditorPanel from './FileEditorPanel.jsx'

const API = import.meta.env.VITE_API_URL || ''

const FILES = [
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
]

export default function ConfigFilesPage({ onSave }) {
  const [contents, setContents] = useState({})
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null) // { id }

  const loadAll = useCallback(async () => {
    setLoading(true)
    const result = {}
    for (const f of FILES) {
      try {
        const res = await fetch(`${API}/api/nginx-configs/${f.id}`)
        result[f.id] = res.ok ? (await res.json()).content : null
      } catch {
        result[f.id] = null
      }
    }
    setContents(result)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleSave = async (newContent) => {
    const { id } = editing
    const res = await fetch(`${API}/api/nginx-configs/${id}`, {
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

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <>
      <div className="host-grid">
        {FILES.map(file => {
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
              {file.warning && (
                <p className="conf-card-warn">⚠ {file.warning}</p>
              )}

              <div className="host-actions">
                {missing ? (
                  <span className="conf-card-missing">
                    Not found — check /config/nginx mount
                  </span>
                ) : (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setEditing({ id: file.id })}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <FileEditorPanel
          title={editing.id}
          content={contents[editing.id] ?? ''}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
