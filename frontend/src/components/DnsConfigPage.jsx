import { useState, useEffect, useCallback } from 'react'
import FileEditorPanel from './FileEditorPanel.jsx'

const API = import.meta.env.VITE_API_URL || ''

function providerName(filename) {
  return filename.replace(/\.ini\.sample$/, '').replace(/\.sample$/, '').replace(/\.ini$/, '')
}

export default function DnsConfigPage() {
  const [files, setFiles]     = useState([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState(null)
  const [editing, setEditing] = useState(null)  // { filename, content }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/dns-configs`)
      const data = res.ok ? await res.json() : {}
      setFiles(data.files || [])
      setWarning(data.warning || null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = async (filename) => {
    const res = await fetch(`${API}/api/dns-configs/${encodeURIComponent(filename)}`)
    if (!res.ok) return
    const data = await res.json()
    setEditing({ filename, content: data.content })
  }

  const handleSave = async (newContent) => {
    const res = await fetch(`${API}/api/dns-configs/${encodeURIComponent(editing.filename)}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: newContent }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Save failed')
    }
  }

  if (loading) return <div className="loading-state">Loading...</div>

  // Configured (.ini) first, then samples — each group sorted alphabetically
  const sorted = [...files].sort((a, b) => {
    if (a.is_sample !== b.is_sample) return a.is_sample ? 1 : -1
    return a.filename.localeCompare(b.filename)
  })

  return (
    <>
      {warning && <div className="warning-banner">{warning}</div>}

      {sorted.length === 0 ? (
        <div className="empty-state">
          <p>No DNS config files found.</p>
          <p>Check that <code>/config/dns-conf</code> is mounted correctly.</p>
        </div>
      ) : (
        <div className="host-grid">
          {sorted.map(file => (
            <div
              key={file.filename}
              className={`host-card ${file.is_sample ? 'disabled' : ''}`}
            >
              <div className="host-card-header">
                <div className="host-name-row">
                  <h3 className="host-name">{providerName(file.filename)}</h3>
                  <span className={`badge ${file.is_sample ? 'badge-status-sample' : 'badge-status-active'}`}>
                    {file.is_sample ? 'sample' : 'configured'}
                  </span>
                </div>
                <div
                  className={`status-dot ${file.is_sample ? 'inactive' : 'active'}`}
                  title={file.is_sample ? 'Template — not active' : 'Configured'}
                />
              </div>

              <p className="conf-card-filename">{file.filename}</p>

              <div className="host-actions">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => openEdit(file.filename)}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <FileEditorPanel
          title={editing.filename}
          content={editing.content}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
