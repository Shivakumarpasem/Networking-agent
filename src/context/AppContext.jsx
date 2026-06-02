import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'

const AppContext = createContext(null)

const LS_KEY = 'networking_contacts_v1'

const STATUS_PRIORITY = {
  'Follow Up Due': 0,
  'Awaiting Reply': 1,
  'Reply Received': 2,
  'Message Sent': 3,
  'New': 4,
  'Closed': 5,
}

function applyFollowUpDue(contacts) {
  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return contacts.map(c => {
    if (c.status === 'Awaiting Reply' && c.lastContactDate) {
      if (now - new Date(c.lastContactDate).getTime() >= sevenDays) {
        return { ...c, status: 'Follow Up Due' }
      }
    }
    return c
  })
}

function readLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function AppProvider({ children }) {
  const [contacts, setContacts] = useState([])
  const [isLoaded, setIsLoaded] = useState(false)
  const saveTimer = useRef(null)

  // Load contacts from server on mount; fall back to localStorage for migration
  useEffect(() => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then(({ contacts: serverData }) => {
        if (serverData && serverData.length > 0) {
          // Server has data — use it
          setContacts(applyFollowUpDue(serverData))
        } else {
          // Server empty — migrate from localStorage if anything is there
          const local = readLocalStorage()
          setContacts(applyFollowUpDue(local))
        }
      })
      .catch(() => {
        // Server unreachable — fall back to localStorage
        setContacts(applyFollowUpDue(readLocalStorage()))
      })
      .finally(() => setIsLoaded(true))
  }, [])

  // Save to server (debounced 400ms) whenever contacts change
  useEffect(() => {
    if (!isLoaded) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      }).catch(console.error)
    }, 400)
  }, [contacts, isLoaded])

  const addContact = useCallback((data) => {
    const id = uuidv4()
    const messages = []
    if (data.conversationHistory?.trim()) {
      messages.push({
        id: uuidv4(),
        type: 'history',
        content: data.conversationHistory.trim(),
        timestamp: new Date().toISOString(),
      })
    }
    const contact = {
      id,
      name: data.name.trim(),
      jobTitle: data.jobTitle?.trim() || '',
      company: data.company?.trim() || '',
      relationshipType: data.relationshipType || 'other',
      status: 'New',
      messages,
      coachChat: [],
      lastContactDate: null,
      createdAt: new Date().toISOString(),
    }
    setContacts(prev => [contact, ...prev])
    return id
  }, [])

  const updateContact = useCallback((id, updates) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [])

  const deleteContact = useCallback((id) => {
    setContacts(prev => prev.filter(c => c.id !== id))
  }, [])

  const addMessage = useCallback((contactId, msgData) => {
    const msg = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...msgData,
    }
    setContacts(prev => prev.map(c => {
      if (c.id !== contactId) return c
      let statusUpdate = {}
      if (msgData.type === 'sent') {
        statusUpdate = { status: 'Awaiting Reply', lastContactDate: new Date().toISOString() }
      } else if (msgData.type === 'received') {
        statusUpdate = { status: 'Reply Received', lastContactDate: new Date().toISOString() }
      }
      return { ...c, messages: [...c.messages, msg], ...statusUpdate }
    }))
  }, [])

  const addCoachMessage = useCallback((contactId, msgData) => {
    const msg = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...msgData,
    }
    setContacts(prev => prev.map(c =>
      c.id === contactId
        ? { ...c, coachChat: [...(c.coachChat || []), msg] }
        : c
    ))
  }, [])

  const sortedContacts = [...contacts].sort(
    (a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9)
  )

  return (
    <AppContext.Provider value={{
      contacts, sortedContacts, isLoaded,
      addContact, updateContact, deleteContact, addMessage, addCoachMessage,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
