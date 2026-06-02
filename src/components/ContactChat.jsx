import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import StatusBadge from './StatusBadge.jsx'
import { coachChat, firstMessage as aiFirstMessage } from '../services/ai.js'

const REL_LABELS = {
  recruiter: 'Recruiter',
  engineer: 'Engineer',
  hiring_manager: 'Hiring Manager',
  other: 'Other',
}

const STATUS_OPTIONS = ['New', 'Message Sent', 'Awaiting Reply', 'Reply Received', 'Follow Up Due', 'Closed']

const STARTERS = [
  'What should I say next?',
  'Write a follow-up message for me',
  'Is this conversation going well?',
  'Should I give up on this contact?',
  'How should I respond to their last message?',
  'What is the best timing here?',
]

function formatHistory(messages, contactName) {
  return messages
    .filter(m => ['sent', 'received', 'history'].includes(m.type))
    .map(m => {
      if (m.type === 'sent') return `You: ${m.content}`
      if (m.type === 'received') return `${contactName}: ${m.content}`
      if (m.type === 'history') return `[Prior conversation]\n${m.content}`
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

// ── First Message Card (shown when contact has no messages yet) ─────────────
function FirstMessageCard({ contact, onUse }) {
  const [context, setContext] = useState('')
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!context.trim()) return
    setIsLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await aiFirstMessage(contact, context.trim())
      setResult(data)
    } catch (err) {
      setError(err.message.includes('fetch') ? 'Cannot connect to AI server. Make sure it is running.' : err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="first-msg-card">
      <div className="first-msg-icon">✉️</div>
      <h4>Write your first message to {contact.name}</h4>
      <p>Tell me why you're reaching out. The more specific you are, the better the message.</p>

      <textarea
        className="form-textarea"
        value={context}
        onChange={e => setContext(e.target.value)}
        placeholder={
          contact.relationshipType === 'recruiter'
            ? 'e.g. They posted about a Meta SWE role on LinkedIn. I have 3 years of backend experience in Python and I want to apply.'
            : 'e.g. I saw their post about scaling systems at Google. I want to ask about their experience transitioning from startup to big tech.'
        }
        style={{ minHeight: 90, marginTop: 12, width: '100%' }}
      />

      <button
        className="btn btn-ai"
        style={{ width: '100%', marginTop: 10 }}
        onClick={handleGenerate}
        disabled={!context.trim() || isLoading}
      >
        {isLoading ? (
          <><div className="ai-spinner" style={{ width: 14, height: 14 }} /> Writing...</>
        ) : '✨ Generate First Message'}
      </button>

      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}

      {result && (
        <div className="first-msg-result">
          <div className="first-msg-result-meta">
            {result.tone && <span className="tone-badge">{result.tone}</span>}
            {result.timing && <span className="ai-timing">⏰ {result.timing}</span>}
          </div>
          <div className="ai-suggested-message">{result.message}</div>
          {result.advice && <div className="ai-advice">💡 {result.advice}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn-primary btn-sm" onClick={() => onUse(result.message)}>
              Use This Message
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              navigator.clipboard.writeText(result.message)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setResult(null)}>
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AI Coach Panel (right side, always visible) ─────────────────────────────
function CoachPanel({ contact }) {
  const { addCoachMessage } = useApp()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const msgs = contact.coachChat || []

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length, isLoading])

  const send = async (text) => {
    const content = (text || input).trim()
    if (!content || isLoading) return
    setInput('')
    setError('')
    addCoachMessage(contact.id, { role: 'user', content })
    setIsLoading(true)
    try {
      const history = formatHistory(contact.messages, contact.name)
      const chatHistory = [...msgs, { role: 'user', content }]
      const result = await coachChat(contact, history, chatHistory)
      addCoachMessage(contact.id, { role: 'assistant', content: result.message })
    } catch (err) {
      setError(err.message.includes('fetch') ? 'Cannot connect to AI server.' : err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = ts =>
    new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="coach-side">
      <div className="coach-side-header">
        ✨ AI Coach — ask anything about {contact.name}
      </div>
      <div className="coach-messages">
        {msgs.length === 0 ? (
          <div className="coach-empty">
            <p>I have full context on your conversation.<br />Ask me anything.</p>
            <div className="coach-starters">
              {STARTERS.map(s => (
                <button key={s} className="coach-starter-btn" onClick={() => send(s)} disabled={isLoading}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map(msg => (
            <div key={msg.id} className={`coach-msg ${msg.role}`}>
              <div className="coach-msg-bubble">{msg.content}</div>
              <div className="coach-msg-time">{formatTime(msg.timestamp)}</div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="coach-msg assistant">
            <div className="coach-msg-bubble" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div className="ai-spinner" style={{ width: 13, height: 13 }} />
              Thinking...
            </div>
          </div>
        )}
        {error && <div className="ai-error" style={{ margin: '8px 12px' }}>⚠️ {error}</div>}
        <div ref={endRef} />
      </div>

      <div className="coach-input-row">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
          disabled={isLoading}
        />
        <button className="btn btn-ai btn-sm" onClick={() => send()} disabled={!input.trim() || isLoading}>
          Send
        </button>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ContactChat({ contact }) {
  const { addMessage, updateContact, deleteContact } = useApp()
  const navigate = useNavigate()
  const [action, setAction] = useState(null)
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [contact.messages.length])

  useEffect(() => {
    setAction(null)
    setInputText('')
  }, [contact.id])

  const handleConfirmAction = () => {
    if (!inputText.trim()) return
    addMessage(contact.id, { type: action, content: inputText.trim() })
    setAction(null)
    setInputText('')
  }

  const handleNoReply = () =>
    addMessage(contact.id, { type: 'no-reply', content: 'No reply received.' })

  const handleDelete = () => {
    if (window.confirm(`Delete ${contact.name}? This cannot be undone.`)) {
      deleteContact(contact.id)
      navigate('/contacts')
    }
  }

  const formatTime = ts =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const threadMessages = contact.messages.filter(m => m.type !== 'ai-suggestion')
  const hasMessages = threadMessages.length > 0

  return (
    <div className="chat-panel">
      {/* ── Header ── */}
      <div className="chat-header">
        <div className="chat-header-info">
          <h3>{contact.name}</h3>
          <p>
            {[contact.jobTitle, contact.company].filter(Boolean).join(' at ')}
            {(contact.jobTitle || contact.company) && ' · '}
            <span className={`rel-badge ${contact.relationshipType}`}>
              {REL_LABELS[contact.relationshipType] || 'Other'}
            </span>
          </p>
        </div>
        <div className="chat-header-actions">
          <select
            className="form-select"
            style={{ width: 'auto', fontSize: 12, padding: '5px 8px' }}
            value={contact.status}
            onChange={e => updateContact(contact.id, { status: e.target.value })}
          >
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
          <StatusBadge status={contact.status} />
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
        </div>
      </div>

      {/* ── Body: side-by-side ── */}
      <div className="chat-body">

        {/* Left — Messages */}
        <div className="chat-messages-side">
          <div className="chat-messages">
            {!hasMessages ? (
              <FirstMessageCard
                contact={contact}
                onUse={(msg) => { setAction('sent'); setInputText(msg) }}
              />
            ) : (
              threadMessages.map(msg => {
                const wrapperClass = msg.type === 'sent' ? 'sent'
                  : (msg.type === 'history' || msg.type === 'no-reply') ? 'history'
                  : 'received'
                const bubbleClass = {
                  sent: 'sent', received: 'received',
                  history: 'history', 'no-reply': 'system-note',
                }[msg.type] || 'system-note'
                return (
                  <div key={msg.id} className={`message-wrapper ${wrapperClass}`}>
                    {(msg.type === 'history' || msg.type === 'no-reply') && (
                      <div className="message-label">
                        {msg.type === 'history' ? 'Pasted History' : 'System Note'}
                      </div>
                    )}
                    <div className={`message-bubble ${bubbleClass}`}>{msg.content}</div>
                    <div className={`message-meta${msg.type === 'sent' ? ' align-right' : ''}`}>
                      {msg.type === 'sent' && 'You sent · '}
                      {msg.type === 'received' && 'Their reply · '}
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Action buttons */}
          <div className="chat-actions">
            {action === null ? (
              <div className="chat-action-buttons">
                <button className="btn btn-primary btn-sm" onClick={() => setAction('sent')}>+ Log Sent</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setAction('received')}>Paste Reply</button>
                <button className="btn btn-secondary btn-sm" onClick={handleNoReply}>No Reply</button>
              </div>
            ) : (
              <div className="chat-input-form">
                <div className="form-label" style={{ marginBottom: 5 }}>
                  {action === 'sent' ? 'What did you send?' : 'Paste their reply:'}
                </div>
                <div className="chat-input-area">
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={action === 'sent' ? 'Paste the message you sent...' : 'Paste their reply...'}
                    autoFocus
                  />
                  <div className="chat-input-buttons">
                    <button className="btn btn-primary btn-sm" onClick={handleConfirmAction} disabled={!inputText.trim()}>
                      {action === 'sent' ? 'Mark Sent' : 'Add Reply'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setAction(null); setInputText('') }}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right — AI Coach (always visible) */}
        <CoachPanel contact={contact} />
      </div>
    </div>
  )
}
