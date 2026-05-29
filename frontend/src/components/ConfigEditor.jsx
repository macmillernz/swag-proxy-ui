import { useState, useEffect, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || ''
const FILES = ['nginx.conf', 'proxy.conf', 'resolver.conf', 'ssl.conf']

const WARNINGS = {
  'proxy.conf': 'Changes here affect all proxy hosts.',
  'resolver.conf': 'Changes here affect all proxy hosts.',
  'ssl.conf': 'Changes here affect all SSL termination.',
}

export default function ConfigEditor({ onDirty }) {
  const [active, setActive] = useState('nginx.conf')
  const [contents, setContents] = useState({})
  const [saved, setSaved] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    const result = {}
    for (const file of FILES) {
      try {
        const res = await fetch(`${API}/api/nginx-configs/${file}`)
        result[file] = res.ok ? (await res.json()).content : null
      } catch {
        result[file] = null
      }
    }
    setContents(result)
    setSaved(result)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const isDirty = (file) => contents[file] !== saved[file]
  const anyDirty = FILES.some(isDirty)

  useEffect(() => {
    onDirty?.(anyDirty)
  }, [anyDirty, onDirty])

  const handleChange = (val) => {
    setContents(c => ({ ...c, [active]: val }))
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/nginx-configs/${active}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: contents[active] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.detail || 'Save failed')
      } else {
        setSaved(s => ({ ...s, [active]: contents[active] }))
        showToast(`${active} saved`)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="conf-editor-page">
      <div className="conf-tab-bar">
        {FILES.map(file => (
          <button
            key={file}
            className={`conf-tab ${active === file ? 'active' : ''}`}
            onClick={() => setActive(file)}
          >
            {file}
            {isDirty(file) && <span className="dirty-dot" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : contents[active] === null ? (
        <div className="conf-missing">
          <p><strong>{active}</strong> not found.</p>
          <p>Make sure <code>/config/nginx</code> is mounted correctly.</p>
        </div>
      ) : (
        <>
          {WARNINGS[active] && (
            <div className="warning-banner" style={{ marginBottom: '1rem' }}>
              ⚠ {WARNINGS[active]} Always reload nginx to test.
            </div>
          )}
          <textarea
            className="conf-textarea"
            value={contents[active]}
            onChange={e => handleChange(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <div className="conf-actions">
            {error && <span className="form-error" style={{ flex: 1 }}>{error}</span>}
            <span className="conf-status">{isDirty(active) ? 'Unsaved changes' : 'Saved'}</span>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={saving || !isDirty(active)}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
