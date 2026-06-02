import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import AddContactModal from '../components/AddContactModal.jsx'
import ContactChat from '../components/ContactChat.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function Contacts() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { contacts } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = contacts.filter(c =>
    [c.name, c.company, c.jobTitle].some(v =>
      v.toLowerCase().includes(search.toLowerCase())
    )
  )

  const selectedContact = id ? contacts.find(c => c.id === id) : null

  return (
    <div className="contacts-layout">
      <div className="contacts-list-panel">
        <div className="contacts-list-header">
          <h3>Contacts ({contacts.length})</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            + Add
          </button>
        </div>
        <div className="contacts-search">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company..."
          />
        </div>
        <div className="contact-list-items">
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              {search ? 'No matches found.' : 'No contacts yet. Add one!'}
            </div>
          ) : (
            filtered.map(c => (
              <div
                key={c.id}
                className={`contact-list-item${c.id === id ? ' active' : ''}`}
                onClick={() => navigate(`/contacts/${c.id}`)}
              >
                <div className="item-name">{c.name}</div>
                <div className="item-sub">
                  {[c.jobTitle, c.company].filter(Boolean).join(' · ')}
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))
          )}
        </div>
      </div>

      {selectedContact ? (
        <ContactChat contact={selectedContact} />
      ) : (
        <div className="welcome-panel">
          <div style={{ fontSize: 52 }}>💬</div>
          <h3>Select a Contact</h3>
          <p>
            Choose a contact from the list to view their conversation and manage follow-ups,
            or add a new contact to get started.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Add Contact
          </button>
        </div>
      )}

      {showModal && (
        <AddContactModal
          onClose={() => setShowModal(false)}
          onAdded={newId => navigate(`/contacts/${newId}`)}
        />
      )}
    </div>
  )
}
