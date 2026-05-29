import { useState, useEffect, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { StreamLanguage } from '@codemirror/language'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { nginx } from '@codemirror/legacy-modes/mode/nginx'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

const API = import.meta.env.VITE_API_URL || ''
const FILES = ['nginx.conf', 'proxy.conf', 'resolver.conf', 'ssl.conf']

const WARNINGS = {
  'proxy.conf':    'Changes here affect all proxy hosts.',
  'resolver.conf': 'Changes here affect upstream DNS resolution.',
  'ssl.conf':      'Changes here affect all SSL termination.',
}

// ── Custom theme matching the app palette ─────────────────────────────────────
const themeBase = EditorView.theme({
  '&': {
    backgroundColor: '#18181c',
    color: '#f0efe8',
    fontSize: '13px',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  },
  '.cm-content': { caretColor: '#5c8fe2', padding: '0.75rem 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#5c8fe2' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { background: 'rgba(92,143,226,0.28)' },
  '.cm-gutters': {
    backgroundColor: '#18181c',
    color: '#5a5956',
    border: 'none',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    paddingRight: '4px',
    minWidth: '36px',
  },
  '.cm-lineNumbers .cm-gutterElement': { color: '#5a5956' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.04)', color: '#a09e98 !important' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.03)' },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'rgba(92,143,226,0.25)',
    outline: 'none',
  },
  '.cm-line': { padding: '0 1rem 0 0.5rem' },
  '.cm-scroller': { lineHeight: '1.6', overflow: 'auto' },
}, { dark: true })

const themeHighlight = HighlightStyle.define([
  { tag: t.comment,                    color: '#5a5956', fontStyle: 'italic' },
  { tag: t.keyword,                    color: '#5c8fe2' },         // directives: server, location …
  { tag: t.definitionKeyword,          color: '#5c8fe2' },
  { tag: t.string,                     color: '#5cb87a' },         // quoted strings
  { tag: t.number,                     color: '#e2a45c' },         // ports, sizes
  { tag: t.variableName,               color: '#c9a0dc' },         // $upstream_app
  { tag: t.special(t.variableName),    color: '#c9a0dc' },
  { tag: t.operator,                   color: '#a09e98' },
  { tag: t.punctuation,                color: '#a09e98' },
  { tag: t.bracket,                    color: '#f0efe8' },         // braces {}
  { tag: t.bool,                       color: '#e2a45c' },
  { tag: t.meta,                       color: '#e2a45c' },
  { tag: t.atom,                       color: '#e2a45c' },
  { tag: t.url,                        color: '#5cb87a' },
])

const extensions = [
  StreamLanguage.define(nginx),
  syntaxHighlighting(themeHighlight),
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function ConfigEditor({ onDirty }) {
  const [active, setActive]     = useState('nginx.conf')
  const [contents, setContents] = useState({})
  const [saved, setSaved]       = useState({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [toast, setToast]       = useState(null)

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

  const isDirty  = (file) => contents[file] !== saved[file]
  const anyDirty = FILES.some(isDirty)
  useEffect(() => { onDirty?.(anyDirty) }, [anyDirty, onDirty])

  const handleChange = useCallback((val) => {
    setContents(c => ({ ...c, [active]: val }))
    setError(null)
  }, [active])

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
              ⚠ {WARNINGS[active]} Always reload nginx after saving.
            </div>
          )}

          <div className="cm-wrapper">
            <CodeMirror
              value={contents[active]}
              onChange={handleChange}
              theme={themeBase}
              extensions={extensions}
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
