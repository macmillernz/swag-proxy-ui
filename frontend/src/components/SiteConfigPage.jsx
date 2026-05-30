import { useState, useEffect, useCallback } from 'react'
import FileEditorPanel from './FileEditorPanel.jsx'

const API = import.meta.env.VITE_API_URL || ''

export default function SiteConfigPage() {
  const [files, setFiles]     = useState([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState(null)
  const [editing, setEditing] = useState(null)  // { filename, content }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/site-confs`)
      const data = res.ok ? await res.json() : {}
      setFiles(data.files || [])
      setWarning(data.warning || null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = async (filename) => {
    const res = await fetch(`${API}/api/site-confs/${encodeURIComponent(filename)}`)
    if (!res.ok) return
    const data = await res.json()
    setEditing({ filename, content: data.content })
  }

  const handleSave = async (newContent) => {
    const res = await fetch(`${API}/api/site-confs/${encodeURIComponent(editing.filename)}`, {
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

  return (
    <>
      {warning && <div className="warning-banner">{warning}</div>}

      {files.length === 0 ? (
        <div className="empty-state">
          <p>No site conf files found.</p>
          <p>Check that <code>/config/nginx/site-confs</code> is mounted correctly.</p>
        </div>
      ) : (
        <div className="host-grid">
          {files.map(file => (
            <div key={file.filename} className="host-card">
              <div className="host-card-header">
                <div className="host-name-row">
                  <h3 className="host-name">{file.filename}</h3>
                </div>
                <div className="status-dot active" title="Active" />
              </div>

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
