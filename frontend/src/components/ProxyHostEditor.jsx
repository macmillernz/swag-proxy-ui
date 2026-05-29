import FileEditorPanel from './FileEditorPanel.jsx'

const API = import.meta.env.VITE_API_URL || ''

export default function ProxyHostEditor({ name, content, onSave, onClose }) {
  const handleSave = async (newContent) => {
    const res = await fetch(`${API}/api/proxy-hosts/${name}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Save failed')
    }
    onSave()
  }

  return (
    <FileEditorPanel
      title={name}
      content={content}
      onSave={handleSave}
      onClose={onClose}
    />
  )
}
