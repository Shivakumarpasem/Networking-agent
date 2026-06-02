import { Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Contacts from './pages/Contacts.jsx'
import NoteGenerator from './pages/NoteGenerator.jsx'

export default function App() {
  return (
    <AppProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/:id" element={<Contacts />} />
            <Route path="/note-generator" element={<NoteGenerator />} />
          </Routes>
        </main>
      </div>
    </AppProvider>
  )
}
