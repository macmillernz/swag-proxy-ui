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
}

export default function ProxyHostForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...DEFAULT, ...initial, custom_location: initial.custom_location || '' } : DEFAULT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({
        ...form,
        upstream_port: parseInt(form.upstream_port, 10),
        custom_location: form.type === 'subfolder' && form.custom_location ? form.custom_location : null,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const filename = `${form.name || 'name'}.${form.type}.conf${form.enabled ? '' : '.disabled'}`

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel">
        <header className="panel-header">
          <h2>{initial ? 'Edit Proxy Host' : 'Add Proxy Host'}</h2>
          <button className="close-btn" onClick={onClose} type="button">✕</button>
        </header>

        <form onSubmit={handleSubmit} className="panel-form">
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
              <label>Location Path <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
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
            <div className="form-group" style={{ width: '100px' }}>
              <label>Port</label>
              <input
                type="number"
                value={form.upstream_port}
                onChange={e => set('upstream_port', e.target.value)}
                min={1}
                max={65535}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Upstream Protocol</label>
            <select value={form.upstream_proto} onChange={e => set('upstream_proto', e.target.value)}>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
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
