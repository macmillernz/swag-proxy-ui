import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

const API = import.meta.env.VITE_API_URL || ''

// ── Log line colouring ────────────────────────────────────────────────────────

// Log levels are matched as UPPERCASE standalone words (fail2ban/Python style)
// or bracketed lowercase (nginx style: [error]). This avoids false positives
// from lowercase words inside paths/text, e.g. "/config/log/nginx/error.log".
const LVL_ERROR = String.raw`\b(?:ERROR|CRIT(?:ICAL)?|FATAL|ALERT|EMERG)\b|\[(?:error|err|crit|alert|emerg)\]`
const LVL_WARN  = String.raw`\b(?:WARNING|WARN)\b|\[(?:warn|warning)\]`
const LVL_INFO  = String.raw`\b(?:NOTICE|INFO)\b|\[(?:notice|info)\]`
const LVL_DEBUG = String.raw`\b(?:DEBUG|TRACE)\b|\[(?:debug|trace)\]`

// Token groups: 1-2 timestamp, 3 IP, 4 quoted string, 5 error, 6 warn, 7 info, 8 debug
const TOKEN_RE = new RegExp(
  String.raw`(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)` +
  String.raw`|(\[\d{2}\/[A-Za-z]{3}\/\d{4}:[^\]]*\])` +
  String.raw`|(\b\d{1,3}(?:\.\d{1,3}){3}\b)` +
  String.raw`|("[^"]*")` +
  `|(${LVL_ERROR})|(${LVL_WARN})|(${LVL_INFO})|(${LVL_DEBUG})`,
  'g'
)

const GROUP_CLASS = {
  1: 'log-ts', 2: 'log-ts', 3: 'log-ip', 4: 'log-str',
  5: 'log-lvl-error', 6: 'log-lvl-warn', 7: 'log-lvl-info', 8: 'log-lvl-debug',
}

function lineSeverity(line) {
  if (new RegExp(LVL_ERROR).test(line)) return 'sev-error'
  if (new RegExp(LVL_WARN).test(line)) return 'sev-warn'
  return ''
}

// Split a line into {text, cls} segments by token type
function tokenize(line) {
  const segs = []
  let last = 0
  TOKEN_RE.lastIndex = 0
  let m
  while ((m = TOKEN_RE.exec(line)) !== null) {
    if (m.index > last) segs.push({ text: line.slice(last, m.index), cls: null })
    let cls = null
    for (let g = 1; g <= 8; g++) { if (m[g] !== undefined) { cls = GROUP_CLASS[g]; break } }
    segs.push({ text: m[0], cls })
    last = m.index + m[0].length
    if (m[0].length === 0) TOKEN_RE.lastIndex++
  }
  if (last < line.length) segs.push({ text: line.slice(last), cls: null })
  return segs
}

// Wrap occurrences of `term` (case-insensitive) in <mark>
function highlight(text, term) {
  if (!term) return text
  const lower = text.toLowerCase()
  const t = lower.includes(term.toLowerCase()) ? term.toLowerCase() : null
  if (!t) return text
  const parts = []
  let i = 0, idx, k = 0
  while ((idx = lower.indexOf(t, i)) !== -1) {
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(<mark key={k++} className="log-mark">{text.slice(idx, idx + t.length)}</mark>)
    i = idx + t.length
  }
  if (i < text.length) parts.push(text.slice(i))
  return parts
}

function LogLine({ text, term }) {
  const sev = lineSeverity(text)
  return (
    <div className={`log-line ${sev}`}>
      {tokenize(text).map((s, i) =>
        s.cls
          ? <span key={i} className={s.cls}>{highlight(s.text, term)}</span>
          : <span key={i}>{highlight(s.text, term)}</span>
      )}
    </div>
  )
}

// ── Log viewer flyout ─────────────────────────────────────────────────────────

function LogViewerPanel({ filepath, onClose }) {
  const [content, setContent]     = useState(null)
  const [truncated, setTruncated] = useState(false)
  const [size, setSize]           = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [term, setTerm]           = useState('')
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

  const allLines = useMemo(
    () => (content ?? '').replace(/\n$/, '').split('\n'),
    [content]
  )

  const q = term.trim().toLowerCase()
  const visible = useMemo(() => {
    const rows = allLines.map((text, n) => ({ n, text }))
    return q ? rows.filter(r => r.text.toLowerCase().includes(q)) : rows
  }, [allLines, q])

  // Scroll to bottom on initial load; to top when a search is applied
  useEffect(() => {
    if (content != null && logRef.current && !q) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (logRef.current && q) logRef.current.scrollTop = 0
  }, [q])

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

        <div className="log-body">
          <div className="log-search-bar">
            <div className="search-wrap">
              <input
                type="search"
                className="search-input"
                placeholder="Filter lines…"
                value={term}
                onChange={e => setTerm(e.target.value)}
                autoFocus
              />
              {term && (
                <button className="search-clear" onClick={() => setTerm('')} aria-label="Clear filter">✕</button>
              )}
            </div>
            {q && (
              <span className="log-match-count">
                {visible.length} of {allLines.length} lines
              </span>
            )}
          </div>

          <div className="log-content" ref={logRef}>
            {loading && <span className="log-placeholder">Loading…</span>}
            {error   && <span className="log-placeholder log-error">{error}</span>}
            {!loading && !error && visible.length === 0 && (
              <span className="log-placeholder">
                {q ? `No lines match "${term}".` : 'Log is empty.'}
              </span>
            )}
            {!loading && !error && visible.map(({ n, text }) => (
              <LogLine key={n} text={text} term={q ? term : ''} />
            ))}
          </div>
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

  if (loading) return <div className="loading-state">Loading...</div>

  return (
    <>
      {warning && <div className="warning-banner">{warning}</div>}

      {files.length === 0 ? (
        <div className="empty-state">
          <p>No log files found.</p>
          <p>Check that <code>/config/log</code> is mounted correctly.</p>
        </div>
      ) : (
        <div className="host-grid">
          {files.map(file => (
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
