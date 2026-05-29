import { useState, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { themeBase, nginxExtensions } from '../lib/nginxEditor.js'

const API = import.meta.env.VITE_API_URL || ''

// ── Conf editor modal ─────────────────────────────────────────────────────────

export default function ProxyHostEditor({ name, content: initialContent, onSave, onClose }) {
  const [content, setContent] = useState(initialContent)
  const [saved, setSaved]     = useState(initialContent)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  const isDirty = content !== saved

  const handleChange = useCallback(val => {
    setContent(val)
    setError(null)
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API}/api/proxy-hosts/${name}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.detail || 'Save failed')
      } else {
        setSaved(content)
        onSave()
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel panel-wide">
        <header className="panel-header">
          <h2 className="panel-title-mono">{name}</h2>
          <button className="close-btn" onClick={onClose} type="button">✕</button>
        </header>

        <div className="cm-wrapper editor-tall">
          <CodeMirror
            value={content}
            onChange={handleChange}
            theme={themeBase}
            extensions={nginxExtensions}
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
          <span className="conf-status">{isDirty ? 'Unsaved changes' : 'Saved'}</span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={saving || !isDirty}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
