import { NavLink } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

export default function Sidebar() {
  const { contacts } = useApp()
  const urgentCount = contacts.filter(c => c.status === 'Follow Up Due').length

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Network Assistant</h1>
        <p>Career networking tool</p>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">📊</span>
          Dashboard
          {urgentCount > 0 && <span className="nav-badge">{urgentCount}</span>}
        </NavLink>
        <NavLink to="/contacts" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">👥</span>
          Contacts
          {contacts.length > 0 && (
            <span className="nav-badge" style={{ background: '#475569' }}>{contacts.length}</span>
          )}
        </NavLink>
        <div className="nav-section-label" style={{ marginTop: 12 }}>Tools</div>
        <NavLink to="/note-generator" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">✍️</span>
          Note Generator
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <p>Career Networking Assistant</p>
      </div>
    </aside>
  )
}
