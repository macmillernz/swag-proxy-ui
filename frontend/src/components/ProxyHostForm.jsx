import { useState } from 'react'

const DEFAULT = {
  name: '',
  type: 'subdomain',
  upstream_host: '',
  upstream_port: 80,
  upstream_proto: 'http',
  websocket: false,
  enabled: true,
  custom_location: '',
  client_max_body_size: '0',
  allow_ips: [],
  extra_locations: [],
}

const DEFAULT_LOCATION = {
  path: '/',
  upstream_host: '',
  upstream_port: 80,
  upstream_proto: 'http',
  websocket: false,
  allow_ips: [],
}

// ── Inline sub-components ────────────────────────────────────────────────────

function AllowListEditor({ ips, onChange }) {
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim()
    if (val && !ips.includes(val)) {
      onChange([...ips, val])
      setInput('')
    }
  }

  return (
    <div className="allow-editor">
      <div className="allow-input-row">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="192.168.1.0/24 or 10.0.0.1"
        />
        <button type="button" className="btn btn-sm btn-ghost" onClick={add}>Add</button>
      </div>
      {ips.length > 0 && (
        <div className="allow-tags">
          {ips.map(ip => (
            <span key={ip} className="allow-tag">
              {ip}
              <button
                type="button"
                className="allow-tag-remove"
                onClick={() => onChange(ips.filter(i => i !== ip))}
              >✕</button>
            </span>
          ))}
          <span className="deny-hint">→ deny all</span>
        </div>
      )}
    </div>
  )
}

function LocationCard({ loc, index, onChange, onRemove }) {
  const set = (key, val) => onChange({ ...loc, [key]: val })

  return (
    <div className="location-card">
      <div className="location-card-header">
        <span className="location-card-title">Location {index + 1}</span>
        <button type="button" className="btn btn-sm btn-danger" onClick={onRemove}>Remove</button>
      </div>

      <div className="form-group">
        <label>Path</label>
        <input
          type="text"
          value={loc.path}
          onChange={e => set('path', e.target.value)}
          placeholder="/api/"
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group flex-1">
          <label>Upstream Host</label>
          <input
            type="text"
            value={loc.upstream_host}
            onChange={e => set('upstream_host', e.target.value)}
            placeholder="container-name or IP"
            required
          />
        </div>
        <div className="form-group" style={{ width: '100px' }}>
          <label>Port</label>
          <input
            type="number"
            value={loc.upstream_port}
            onChange={e => set('upstream_port', parseInt(e.target.value, 10) || 80)}
            min={1}
            max={65535}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group flex-1">
          <label>Protocol</label>
          <select value={loc.upstream_proto} onChange={e => set('upstream_proto', e.target.value)}>
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>
        <div className="form-group" style={{ alignSelf: 'flex-end', paddingBottom: '2px' }}>
          <label className="toggle-label" style={{ gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text2)' }}>WebSocket</span>
            <div
              className={`toggle ${loc.websocket ? 'on' : ''}`}
              onClick={() => set('websocket', !loc.websocket)}
            />
          </label>
        </div>
      </div>

      <div className="form-group">
        <label>Allow IPs <span className="label-hint">(optional — adds deny all)</span></label>
        <AllowListEditor ips={loc.allow_ips} onChange={v => set('allow_ips', v)} />
      </div>
    </div>
  )
}

// ── Main form ────────────────────────────────────────────────────────────────

export default function ProxyHostForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? { ...DEFAULT, ...initial, custom_location: initial.custom_location || '', allow_ips: initial.allow_ips || [], extra_locations: initial.extra_locations || [] }
      : DEFAULT
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [openSection, setOpenSection] = useState({ access: false, locations: false })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const toggleSection = key => setOpenSection(s => ({ ...s, [key]: !s[key] }))

  const updateLocation = (i, updated) =>
    set('extra_locations', form.extra_locations.map((l, idx) => idx === i ? updated : l))
  const removeLocation = i =>
    set('extra_locations', form.extra_locations.filter((_, idx) => idx !== i))
  const addLocation = () =>
    set('extra_locations', [...form.extra_locations, { ...DEFAULT_LOCATION }])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        ...form,
        upstream_port: parseInt(form.upstream_port, 10),
        custom_location: form.type === 'subfolder' && form.custom_location ? form.custom_location : null,
        extra_locations: form.extra_locations.map(loc => ({
          ...loc,
          upstream_port: parseInt(loc.upstream_port, 10) || 80,
        })),
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const filename = `${form.name || 'name'}.${form.type}.conf${form.enabled ? '' : '.disabled'}`
  const hasAllowIps = form.allow_ips.length > 0
  const hasLocations = form.extra_locations.length > 0

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <header className="panel-header">
          <h2>{initial ? 'Edit Proxy Host' : 'Add Proxy Host'}</h2>
          <button className="close-btn" onClick={onClose} type="button">✕</button>
        </header>

        <form onSubmit={handleSubmit} className="panel-form">

          {/* ── Basic ── */}
          <div className="form-group">
            <label>Service Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="e.g. grafana"
              required
              disabled={!!initial}
            />
            <span className="form-hint">{filename}</span>
          </div>

          <div className="form-group">
            <label>Proxy Type</label>
            <div className="radio-group">
              <label className="radio-option">
                <input type="radio" value="subdomain" checked={form.type === 'subdomain'} onChange={e => set('type', e.target.value)} />
                <span>Subdomain</span>
                <small>grafana.example.com</small>
              </label>
              <label className="radio-option">
                <input type="radio" value="subfolder" checked={form.type === 'subfolder'} onChange={e => set('type', e.target.value)} />
                <span>Subfolder</span>
                <small>example.com/grafana</small>
              </label>
            </div>
          </div>

          {form.type === 'subfolder' && (
            <div className="form-group">
              <label>Location Path <span className="label-hint">(optional)</span></label>
              <input
                type="text"
                value={form.custom_location}
                onChange={e => set('custom_location', e.target.value)}
                placeholder={`/${form.name || 'name'}`}
              />
            </div>
          )}

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Upstream Host</label>
              <input
                type="text"
                value={form.upstream_host}
                onChange={e => set('upstream_host', e.target.value)}
                placeholder="container-name or IP"
                required
              />
            </div>
            <div className="form-group" style={{ width: '90px' }}>
              <label>Port</label>
              <input
                type="number"
                value={form.upstream_port}
                onChange={e => set('upstream_port', e.target.value)}
                min={1} max={65535} required
              />
            </div>
            <div className="form-group" style={{ width: '80px' }}>
              <label>Proto</label>
              <select value={form.upstream_proto} onChange={e => set('upstream_proto', e.target.value)}>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Max Body Size</label>
            <input
              type="text"
              value={form.client_max_body_size}
              onChange={e => set('client_max_body_size', e.target.value)}
              placeholder="0"
            />
            <span className="form-hint">0 = unlimited. Use units: 10m, 1g</span>
          </div>

          <div className="form-toggles">
            <label className="toggle-label">
              <span>WebSocket Support</span>
              <div className={`toggle ${form.websocket ? 'on' : ''}`} onClick={() => set('websocket', !form.websocket)} />
            </label>
            <label className="toggle-label">
              <span>Enabled</span>
              <div className={`toggle ${form.enabled ? 'on' : ''}`} onClick={() => set('enabled', !form.enabled)} />
            </label>
          </div>

          {/* ── Access control ── */}
          <div className="accordion">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection('access')}
            >
              <span>
                IP Allow List
                {hasAllowIps && <span className="accordion-badge">{form.allow_ips.length}</span>}
              </span>
              <span className="accordion-arrow">{openSection.access ? '▲' : '▼'}</span>
            </button>
            {openSection.access && (
              <div className="accordion-body">
                <p className="accordion-hint">
                  {form.type === 'subdomain'
                    ? 'Applies to the entire server block — all locations inherit this.'
                    : 'Applies to the primary location block.'}
                </p>
                <AllowListEditor ips={form.allow_ips} onChange={v => set('allow_ips', v)} />
              </div>
            )}
          </div>

          {/* ── Extra locations ── */}
          <div className="accordion">
            <button
              type="button"
              className="accordion-header"
              onClick={() => toggleSection('locations')}
            >
              <span>
                Extra Locations
                {hasLocations && <span className="accordion-badge">{form.extra_locations.length}</span>}
              </span>
              <span className="accordion-arrow">{openSection.locations ? '▲' : '▼'}</span>
            </button>
            {openSection.locations && (
              <div className="accordion-body">
                {form.extra_locations.map((loc, i) => (
                  <LocationCard
                    key={i}
                    loc={loc}
                    index={i}
                    onChange={updated => updateLocation(i, updated)}
                    onRemove={() => removeLocation(i)}
                  />
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={addLocation}>
                  + Add Location
                </button>
              </div>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="panel-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : (initial ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
