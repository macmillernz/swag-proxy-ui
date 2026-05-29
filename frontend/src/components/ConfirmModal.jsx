import { useEffect } from 'react'

export default function ConfirmModal({ title, message, onConfirm, onCancel }) {
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}
