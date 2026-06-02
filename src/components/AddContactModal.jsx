import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function AddContactModal({ onClose, onAdded }) {
  const { addContact } = useApp()
  const [form, setForm] = useState({
    name: '',
    jobTitle: '',
    company: '',
    relationshipType: 'other',
    conversationHistory: '',
  })
  const [error, setError] = useState('')

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = e => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required.'); return }
    const id = addContact(form)
    onAdded?.(id)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Add New Contact</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-banner">{error}</div>}

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                className="form-input"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Sarah Johnson"
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input
                  className="form-input"
                  name="jobTitle"
                  value={form.jobTitle}
                  onChange={handleChange}
                  placeholder="e.g. Senior Recruiter"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company</label>
                <input
                  className="form-input"
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="e.g. Google"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Relationship Type</label>
              <select className="form-select" name="relationshipType" value={form.relationshipType} onChange={handleChange}>
                <option value="recruiter">Recruiter</option>
                <option value="engineer">Engineer</option>
                <option value="hiring_manager">Hiring Manager</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Paste Existing Conversation (optional)</label>
              <textarea
                className="form-textarea"
                name="conversationHistory"
                value={form.conversationHistory}
                onChange={handleChange}
                placeholder="Paste any existing LinkedIn messages, emails, or Slack messages here..."
                style={{ minHeight: 110 }}
              />
              <div className="form-hint">This gives context for AI suggestions in future prompts.</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Contact</button>
          </div>
        </form>
      </div>
    </div>
  )
}
