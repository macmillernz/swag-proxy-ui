import { useState, useEffect, useCallback, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || ''

// ── Log viewer flyout ─────────────────────────────────────────────────────────

function LogViewerPanel({ filepath, onClose }) {
  const [content, setContent]     = useState(null)
  const [truncated, setTruncated] = useState(false)
  const [size, setSize]           = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const logRef = useRef(null)

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/logs/${encodeURIComponent(filepath)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        setContent(data.content)
        setTruncated(data.truncated)
        setSize(data.size)
      })
      .catch(() => setError('Could not load log file'))
      .finally(() => setLoading(false))
  }, [filepath])

  // Scroll to bottom when content loads
  useEffect(() => {
    if (content && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [content])

  const filename = filepath.split('/').pop()

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel panel-wide">
        <header className="panel-header">
          <div>
            <h2 className="panel-title-mono">{filename}</h2>
            {filepath.includes('/') && (
              <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                {filepath}
              </p>
            )}
          </div>
          <button className="close-btn" onClick={onClose} type="button">✕</button>
        </header>

        <div className="log-content" ref={logRef}>
          {loading && <span className="log-placeholder">Loading…</span>}
          {error   && <span className="log-placeholder log-error">{error}</span>}
          {content != null && content}
        </div>

        <div className="conf-actions">
          {truncated && (
            <span className="conf-status">
              Showing last 200 KB of {(size / 1024).toFixed(0)} KB
            </span>
          )}
          <button type="button" className="btn btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Logs page ─────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const [files, setFiles]     = useState([])
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState(null)
  const [search, setSearch]   = useState('')
  const [viewing, setViewing] = useState(null)  // filepath string

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/logs`)
      const data = res.ok ? await res.json() : {}
      setFiles(data.files || [])
      setWarning(data.warning || null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = files.filter(f =>
    !search || f.filepath.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <>
      {warning && <div className="warning-banner">{warning}</div>}

      <div className="dns-search-bar">
        <div className="search-wrap">
          <input
            type="search"
            className="search-input"
            placeholder="Search logs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          {files.length === 0
            ? <><p>No log files found.</p><p>Check that <code>/config/log</code> is mounted correctly.</p></>
            : <p>No logs match "{search}".</p>
          }
        </div>
      ) : (
        <div className="host-grid">
          {filtered.map(file => (
            <div key={file.filepath} className="host-card">
              <div className="host-card-header">
                <div className="host-name-row">
                  <h3 className="host-name">{file.filename}</h3>
                  {file.subdir && (
                    <span className="badge badge-log-dir">{file.subdir}</span>
                  )}
                </div>
                <div className="status-dot active" title="Available" />
              </div>

              <div className="host-actions">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setViewing(file.filepath)}
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <LogViewerPanel
          filepath={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  )
}
