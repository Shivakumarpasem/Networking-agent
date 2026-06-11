import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

const REL_LABELS = {
  recruiter: 'Recruiter',
  engineer: 'Engineer',
  hiring_manager: 'Hiring Manager',
  other: 'Other',
}

// Card shown for each contact whose follow-up is due, with the AI-drafted message
function FollowUpCard({ contact }) {
  const { addMessage, updateContact, addSuggestionFeedback, regenerateFollowUp } = useApp()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [rated, setRated] = useState(null)
  const [draft, setDraft] = useState('')
  const fu = contact.followUp

  // Sync the editable draft whenever a (re)generated message arrives
  useEffect(() => {
    setDraft(fu?.message || '')
    if (fu?.message) setRated(null)
  }, [fu?.message])

  const handleMarkSent = () => {
    addMessage(contact.id, { type: 'sent', content: draft.trim() })
  }

  const handleClose = () => {
    updateContact(contact.id, { status: 'Closed', followUp: null })
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleThumbsUp = () => {
    addSuggestionFeedback(contact.id, { rating: 'up', message: fu.message, source: 'follow-up-triage' })
    setRated('up')
  }

  const handleThumbsDown = () => {
    addSuggestionFeedback(contact.id, { rating: 'down', message: fu.message, source: 'follow-up-triage' })
    setRated('down')
    regenerateFollowUp(contact.id) // redraft, avoiding the rejected style
  }

  return (
    <div className="followup-card">
      <div className="followup-card-header">
        <div>
          <span className="followup-card-name" onClick={() => navigate(`/contacts/${contact.id}`)}>
            {contact.name}
          </span>
          <span className="contact-sub" style={{ marginLeft: 8 }}>
            {[contact.jobTitle, contact.company].filter(Boolean).join(' at ')}
          </span>
        </div>
        {fu?.timing && <span className="ai-timing">⏰ {fu.timing}</span>}
      </div>

      {fu ? (
        <>
          <textarea
            className="followup-draft"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            spellCheck
          />
          {fu.reason && <div className="ai-advice">💡 {fu.reason}</div>}
          <div className="followup-card-actions">
            <button className="btn btn-primary btn-sm" onClick={handleMarkSent} disabled={!draft.trim()}>
              ✓ Mark Sent
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/contacts/${contact.id}`)}>
              Open Chat
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleClose}>Close Contact</button>
            <span className="thumb-group">
              <button
                className={`thumb-btn${rated === 'up' ? ' active' : ''}`}
                title="Good draft - remember this style"
                onClick={handleThumbsUp}
                disabled={rated !== null}
              >👍</button>
              <button
                className="thumb-btn"
                title="Bad draft - redraft and avoid this style"
                onClick={handleThumbsDown}
                disabled={rated !== null}
              >👎</button>
              {rated === 'up' && <span className="thumb-ack">Noted</span>}
            </span>
          </div>
        </>
      ) : (
        <div className="followup-card-loading">
          <div className="ai-spinner" style={{ width: 14, height: 14 }} />
          {rated === 'down'
            ? 'Redrafting with your feedback...'
            : 'AI is deciding whether one more message is worth it...'}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { sortedContacts } = useApp()
  const navigate = useNavigate()

  const total = sortedContacts.length
  const dueContacts = sortedContacts.filter(c => c.status === 'Follow Up Due')
  const followUpDue = dueContacts.length
  const active = sortedContacts.filter(c => !['Closed', 'New'].includes(c.status)).length
  const awaitingReply = sortedContacts.filter(c => c.status === 'Awaiting Reply').length

  const formatDate = iso =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'

  const daysSince = iso => {
    if (!iso) return null
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  }

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Your networking overview, sorted by urgency</p>
      </div>

      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Contacts</div>
            <div className="stat-value">{total}</div>
          </div>
          <div className="stat-card urgent">
            <div className="stat-label">Follow Up Due</div>
            <div className="stat-value">{followUpDue}</div>
          </div>
          <div className="stat-card active">
            <div className="stat-label">Active</div>
            <div className="stat-value">{active}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Awaiting Reply</div>
            <div className="stat-value">{awaitingReply}</div>
          </div>
        </div>

        {dueContacts.length > 0 && (
          <div className="followup-section">
            <h3 className="followup-section-title">⚡ Follow-ups ready to send</h3>
            {dueContacts.map(c => <FollowUpCard key={c.id} contact={c} />)}
          </div>
        )}

        <div className="card">
          {sortedContacts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h3>No contacts yet</h3>
              <p>Head to Contacts to add your first networking contact.</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/contacts')}>
                + Add Contact
              </button>
            </div>
          ) : (
            <table className="contacts-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Last Contact</th>
                  <th>Days Since</th>
                </tr>
              </thead>
              <tbody>
                {sortedContacts.map(c => {
                  const days = daysSince(c.lastContactDate)
                  return (
                    <tr
                      key={c.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/contacts/${c.id}`)}
                    >
                      <td>
                        <div className="contact-name-cell">{c.name}</div>
                        <div className="contact-sub">
                          {[c.jobTitle, c.company].filter(Boolean).join(' at ')}
                        </div>
                      </td>
                      <td>
                        <span className={`rel-badge ${c.relationshipType}`}>
                          {REL_LABELS[c.relationshipType] || 'Other'}
                        </span>
                      </td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>{formatDate(c.lastContactDate)}</td>
                      <td>
                        {days !== null ? (
                          <span style={{
                            fontWeight: 700,
                            color: days >= 7 ? '#dc2626' : days >= 3 ? '#d97706' : '#16a34a'
                          }}>
                            {days}d
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
