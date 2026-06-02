import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

const REL_LABELS = {
  recruiter: 'Recruiter',
  engineer: 'Engineer',
  hiring_manager: 'Hiring Manager',
  other: 'Other',
}

export default function Dashboard() {
  const { sortedContacts } = useApp()
  const navigate = useNavigate()

  const total = sortedContacts.length
  const followUpDue = sortedContacts.filter(c => c.status === 'Follow Up Due').length
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
