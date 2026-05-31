import { useState, useEffect, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || ''

// ── helpers ───────────────────────────────────────────────────────────────────

function useEndpoint(path) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${API}${path}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load }
}

function Panel({ title, span, right, children }) {
  return (
    <section className={`dash-panel ${span ? 'dash-span-2' : ''}`}>
      <header className="dash-panel-head">
        <h2>{title}</h2>
        {right}
      </header>
      <div className="dash-panel-body">{children}</div>
    </section>
  )
}

const EXTERNAL = (status) => {
  if (status == null)             return { cls: 'down',  label: 'down' }
  if (status < 400)              return { cls: 'up',    label: String(status) }
  if (status === 401 || status === 403) return { cls: 'auth', label: String(status) }
  if (status < 500)             return { cls: 'warn',  label: String(status) }
  return { cls: 'down', label: String(status) }
}

const STATUS_COLOURS = { '2xx': 'var(--success)', '3xx': 'var(--accent)', '4xx': 'var(--warning)', '5xx': 'var(--danger)' }

function MiniBars({ items, max }) {
  return (
    <ul className="dash-barlist">
      {items.map((it, i) => (
        <li key={i}>
          <span className="dash-barlist-label" title={it.label}>{it.label}</span>
          <span className="dash-barlist-track">
            <span className="dash-barlist-fill" style={{ width: `${max ? (it.count / max) * 100 : 0}%` }} />
          </span>
          <span className="dash-barlist-count">{it.count.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Proxy status panel ────────────────────────────────────────────────────────

function ProxyPanel({ ep }) {
  const { data, loading, error } = ep
  const up = data?.proxies?.filter(p => p.internal_up).length ?? 0
  const total = data?.proxies?.length ?? 0

  return (
    <Panel
      title="Proxy hosts"
      span
      right={!loading && !error && <span className="dash-pill">{up}/{total} upstreams up</span>}
    >
      {loading ? <div className="dash-loading">Probing upstreams…</div>
       : error  ? <div className="dash-err">Could not load proxies.</div>
       : total === 0 ? <div className="dash-empty">No active proxy hosts.</div>
       : (
        <div className="dash-proxy-grid">
          {data.proxies.map(p => {
            const ext = EXTERNAL(p.external_status)
            return (
              <div key={p.name} className="dash-proxy">
                <div className="dash-proxy-name">
                  <span className={`status-dot ${p.internal_up ? 'active' : 'inactive'}`}
                        title={p.internal_up ? 'Upstream reachable' : 'Upstream unreachable'} />
                  <strong>{p.name}</strong>
                  <span className={`badge badge-${p.type}`}>{p.type}</span>
                  {p.auth !== 'none' && <span className="badge badge-auth">{p.auth}</span>}
                </div>
                <div className="dash-proxy-meta">
                  <span className="dash-up" title="Internal upstream">
                    {p.upstream.host ? `${p.upstream.host}:${p.upstream.port}` : '—'}
                  </span>
                  {p.external && (
                    <span className={`dash-ext dash-ext-${ext.cls}`} title={`External: ${p.external}`}>
                      ext {ext.label}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

// ── Traffic panel ─────────────────────────────────────────────────────────────

function TrafficPanel({ ep }) {
  const { data, loading, error } = ep
  const unavailable = data && data.available === false

  const sc = data?.status_classes ?? {}
  const scTotal = Object.values(sc).reduce((a, b) => a + b, 0)
  const maxHour = Math.max(1, ...(data?.hourly ?? []).map(h => h.count))
  const maxPath = Math.max(1, ...(data?.top_paths ?? []).map(p => p.count))
  const maxCty  = Math.max(1, ...(data?.countries ?? []).map(c => c.count))

  return (
    <Panel
      title="Traffic"
      span
      right={data?.available && <span className="dash-pill">{data.total.toLocaleString()} recent requests</span>}
    >
      {loading ? <div className="dash-loading">Reading access log…</div>
       : error  ? <div className="dash-err">Could not load traffic.</div>
       : unavailable ? <div className="dash-empty">{data.warning || 'No access log found.'}</div>
       : (
        <div className="dash-traffic">
          {/* status code stacked bar */}
          <div className="dash-tblock">
            <div className="dash-tlabel">Status codes</div>
            <div className="dash-stack">
              {['2xx','3xx','4xx','5xx'].map(k => sc[k] ? (
                <span key={k} className="dash-stack-seg"
                      style={{ width: `${(sc[k]/scTotal)*100}%`, background: STATUS_COLOURS[k] }}
                      title={`${k}: ${sc[k]}`} />
              ) : null)}
            </div>
            <div className="dash-legend">
              {['2xx','3xx','4xx','5xx'].map(k => (
                <span key={k} className="dash-legend-item">
                  <span className="dash-legend-dot" style={{ background: STATUS_COLOURS[k] }} />
                  {k} <b>{sc[k] || 0}</b>
                </span>
              ))}
            </div>
          </div>

          {/* hourly bars */}
          <div className="dash-tblock">
            <div className="dash-tlabel">Requests / hour</div>
            <div className="dash-hours">
              {(data.hourly ?? []).map((h, i) => (
                <span key={i} className="dash-hour"
                      title={`${h.hour}: ${h.count}`}
                      style={{ height: `${(h.count/maxHour)*100}%` }} />
              ))}
            </div>
          </div>

          <div className="dash-traffic-cols">
            <div className="dash-tblock">
              <div className="dash-tlabel">Top paths</div>
              <MiniBars items={(data.top_paths ?? []).map(p => ({ label: p.path, count: p.count }))} max={maxPath} />
            </div>
            {data.geoip_available && data.countries.length > 0 && (
              <div className="dash-tblock">
                <div className="dash-tlabel">Top countries</div>
                <MiniBars items={data.countries.map(c => ({ label: c.country, count: c.count }))} max={maxCty} />
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}

// ── Fail2ban panel ────────────────────────────────────────────────────────────

function Fail2banPanel({ ep }) {
  const { data, loading, error } = ep
  return (
    <Panel
      title="Fail2ban"
      right={data?.available && <span className="dash-pill">{data.total_banned} banned</span>}
    >
      {loading ? <div className="dash-loading">Loading…</div>
       : error  ? <div className="dash-err">Could not load fail2ban.</div>
       : !data?.available ? <div className="dash-empty">{data?.warning || 'fail2ban database not found.'}</div>
       : data.jails.length === 0 ? <div className="dash-empty">No jails configured.</div>
       : (
        <ul className="dash-jails">
          {data.jails.map(j => (
            <li key={j.name}>
              <span className="dash-jail-name">{j.name}</span>
              <span className="dash-jail-stat">
                <b className={j.banned ? 'danger' : ''}>{j.banned}</b> banned
                <span className="dash-jail-sub">· {j.total} total</span>
              </span>
              <span className="dash-jail-ip">{j.last_ip || '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ── Certs panel ───────────────────────────────────────────────────────────────

function certClass(days) {
  if (days == null) return ''
  if (days < 14) return 'danger'
  if (days < 30) return 'warn'
  return 'ok'
}

function CertsPanel({ ep }) {
  const { data, loading, error } = ep
  return (
    <Panel title="SSL certificates">
      {loading ? <div className="dash-loading">Loading…</div>
       : error  ? <div className="dash-err">Could not load certificates.</div>
       : !data?.certs?.length ? <div className="dash-empty">No certificates found.</div>
       : (
        <ul className="dash-certs">
          {data.certs.map(c => (
            <li key={c.name}>
              <span className="dash-cert-domains" title={c.domains.join(', ')}>
                {c.domains[0] || c.name}
                {c.domains.length > 1 && <span className="dash-cert-more"> +{c.domains.length - 1}</span>}
              </span>
              <span className={`dash-cert-days ${certClass(c.days)}`}>
                {c.days != null ? `${c.days}d` : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const proxies  = useEndpoint('/api/dashboard/proxies')
  const traffic  = useEndpoint('/api/dashboard/traffic')
  const fail2ban = useEndpoint('/api/dashboard/fail2ban')
  const certs    = useEndpoint('/api/dashboard/certs')

  const reloadAll = () => { proxies.reload(); traffic.reload(); fail2ban.reload(); certs.reload() }
  const anyLoading = proxies.loading || traffic.loading || fail2ban.loading || certs.loading

  return (
    <>
      <div className="page-actions-bar">
        <button className="btn btn-ghost btn-sm" onClick={reloadAll} disabled={anyLoading}>
          ↺ {anyLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="dash-grid">
        <ProxyPanel ep={proxies} />
        <TrafficPanel ep={traffic} />
        <Fail2banPanel ep={fail2ban} />
        <CertsPanel ep={certs} />
      </div>
    </>
  )
}
