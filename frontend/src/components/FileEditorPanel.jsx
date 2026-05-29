import { useState, useCallback, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { themeBase, nginxExtensions } from '../lib/nginxEditor.js'

/**
 * Generic full-height flyout panel with a CodeMirror nginx editor.
 *
 * Props:
 *   title   — string shown in the header
 *   content — initial file content
 *   onSave(newContent) — async fn; throw an Error to show a message
 *   onClose — called when the panel should close
 */
export default function FileEditorPanel({ title, content: initialContent, onSave, onClose }) {
  const [content, setContent] = useState(initialContent)
  const [saved, setSaved]     = useState(initialContent)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState(null)

  // Prevent background scroll while open
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  const isDirty = content !== saved

  const handleChange = useCallback(val => {
    setContent(val)
    setError(null)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(content)
      setSaved(content)
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel panel-wide">
        <header className="panel-header">
          <h2 className="panel-title-mono">{title}</h2>
          <button className="close-btn" onClick={onClose} type="button">✕</button>
        </header>

        <div className="cm-wrapper editor-tall">
          <CodeMirror
            value={content}
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
          <span className="conf-status">{isDirty ? 'Unsaved changes' : 'Saved'}</span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
