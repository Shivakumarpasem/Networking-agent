import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { followUpTriage } from '../services/ai.js'
import { formatHistory, countUnanswered, daysSince } from '../utils/messages.js'

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
    if (!c.lastContactDate) return c
    const elapsed = now - new Date(c.lastContactDate).getTime()
    if (['Awaiting Reply', 'Message Sent'].includes(c.status) && elapsed >= sevenDays) {
      return { ...c, status: 'Follow Up Due' }
    }
    // Heal wrong statuses: a contact messaged less than 7 days ago is NOT due
    if (c.status === 'Follow Up Due' && elapsed < sevenDays) {
      return { ...c, status: 'Awaiting Reply', followUp: null }
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
  const saveBlocked = useRef(false) // true when showing stale localStorage data
  const triageInFlight = useRef(new Set()) // contact ids with a triage request running or failed

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
        // Server unreachable — show localStorage data read-only. Saving is
        // blocked so this stale snapshot never overwrites the server data.
        saveBlocked.current = true
        console.warn('Could not reach server — showing local snapshot, auto-save disabled until reload.')
        setContacts(applyFollowUpDue(readLocalStorage()))
      })
      .finally(() => setIsLoaded(true))
  }, [])

  // Re-check follow-up due statuses every hour, not just at page load
  useEffect(() => {
    const timer = setInterval(() => setContacts(prev => applyFollowUpDue(prev)), 60 * 60 * 1000)
    return () => clearInterval(timer)
  }, [])

  // Save to server (debounced 400ms) whenever contacts change
  useEffect(() => {
    if (!isLoaded || saveBlocked.current) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      }).catch(console.error)
    }, 400)
  }, [contacts, isLoaded])

  // Auto-triage: when a contact hits Follow Up Due, ask the AI whether one
  // more message is worth it. If yes — draft it (stored on contact.followUp,
  // shown on the Dashboard). If no — close the contact with a system note.
  useEffect(() => {
    if (!isLoaded) return
    const due = contacts.filter(c =>
      c.status === 'Follow Up Due' &&
      !c.followUp &&
      !triageInFlight.current.has(c.id) &&
      c.messages.some(m => ['sent', 'history'].includes(m.type))
    )
    if (due.length === 0) return

    due.forEach(c => triageInFlight.current.add(c.id))
    ;(async () => {
      for (const c of due) {
        try {
          const result = await followUpTriage(
            c,
            formatHistory(c.messages, c.name),
            daysSince(c.lastContactDate),
            countUnanswered(c.messages),
          )
          if (result.decision === 'close') {
            setContacts(prev => prev.map(x => x.id === c.id ? {
              ...x,
              status: 'Closed',
              followUp: null,
              messages: [...x.messages, {
                id: uuidv4(),
                type: 'no-reply',
                content: `AI Coach closed this contact: ${result.reason}`,
                timestamp: new Date().toISOString(),
              }],
            } : x))
          } else {
            setContacts(prev => prev.map(x => x.id === c.id ? {
              ...x,
              followUp: {
                message: result.message,
                reason: result.reason,
                timing: result.timing,
                generatedAt: new Date().toISOString(),
              },
            } : x))
          }
        } catch (err) {
          // Leave the id in triageInFlight so we don't hammer a failing API;
          // a page reload retries.
          console.error(`Follow-up triage failed for ${c.name}:`, err.message)
        }
      }
    })()
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
        statusUpdate = { status: 'Awaiting Reply', lastContactDate: new Date().toISOString(), followUp: null }
      } else if (msgData.type === 'received') {
        statusUpdate = { status: 'Reply Received', lastContactDate: new Date().toISOString(), followUp: null }
      }
      return { ...c, messages: [...c.messages, msg], ...statusUpdate }
    }))
    // Allow a fresh triage next time this contact becomes due
    triageInFlight.current.delete(contactId)
  }, [])

  // Record thumbs up/down on an AI-drafted message. Stored on the contact and
  // fed back to the AI: rejected drafts become "do not write like this" examples.
  const addSuggestionFeedback = useCallback((contactId, feedback) => {
    setContacts(prev => prev.map(c => c.id === contactId ? {
      ...c,
      suggestionFeedback: [...(c.suggestionFeedback || []), {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        ...feedback,
      }],
    } : c))
  }, [])

  // Clear the current AI follow-up draft and let the triage effect redraft it
  // (used after a thumbs-down so the new draft avoids the rejected style)
  const regenerateFollowUp = useCallback((contactId) => {
    triageInFlight.current.delete(contactId)
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, followUp: null } : c))
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
      addSuggestionFeedback, regenerateFollowUp,
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
