import { useState } from 'react'
import * as aiService from '../services/ai.js'

const MAX_CHARS = 300

export default function NoteGenerator() {
  const [form, setForm] = useState({
    personName: '',
    headline: '',
    jobTitle: '',
    company: '',
    relationshipType: 'recruiter',
    roleApplying: '',
    context: '',
  })
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleGenerate = async () => {
    setIsLoading(true)
    setError('')
    try {
      const contact = {
        name: form.personName || 'this person',
        jobTitle: form.jobTitle,
        company: form.company,
        relationshipType: form.relationshipType,
      }
      const result = await aiService.generateNote(contact, {
        personName: form.personName,
        headline: form.headline,
        jobTitle: form.jobTitle,
        company: form.company,
        roleApplying: form.roleApplying,
        context: form.context,
      })
      setNote(result.note || '')
    } catch (err) {
      setError(
        err.message.includes('fetch')
          ? 'Cannot connect to AI server. Make sure it is running (npm run dev).'
          : err.message
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(note)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const charCount = note.length
  const isOver = charCount > MAX_CHARS
  const canGenerate = (form.context || form.headline || form.jobTitle || form.company) && !isLoading

  return (
    <div>
      <div className="page-header">
        <h2>LinkedIn Note Generator</h2>
        <p>AI-generated connection request note under 300 characters</p>
      </div>

      <div className="page-body">
        <div className="note-generator-layout">
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Contact Details</h3>

            {/* Name + Relationship row */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Their First Name</label>
                <input
                  className="form-input"
                  name="personName"
                  value={form.personName}
                  onChange={handleChange}
                  placeholder="e.g. Sarah"
                />
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
            </div>

            {/* Context — most important field, shown prominently */}
            <div className="form-group">
              <label className="form-label">
                Why are you reaching out? <span style={{ color: 'var(--danger)', fontWeight: 700 }}>*</span>
              </label>
              <textarea
                className="form-textarea"
                name="context"
                value={form.context}
                onChange={handleChange}
                placeholder={
                  form.relationshipType === 'recruiter'
                    ? "e.g. You posted about a Meta Software Engineer role. I'm a SWE with 3 years exp and I'm interested."
                    : "e.g. I saw your post about system design at Google. I'm exploring SWE roles and your background stood out."
                }
                style={{ minHeight: 80 }}
              />
              <div className="form-hint">
                The more specific, the better the note. Mention the exact post, role, or reason you noticed them.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">LinkedIn Headline <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input
                className="form-input"
                name="headline"
                value={form.headline}
                onChange={handleChange}
                placeholder="e.g. Talent Acquisition at XYZ | Hiring for Meta, Google"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Their Job Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="form-input"
                  name="jobTitle"
                  value={form.jobTitle}
                  onChange={handleChange}
                  placeholder="e.g. Technical Recruiter"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Their Company <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="form-input"
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="e.g. TalentHub (3rd party recruiter)"
                />
              </div>
            </div>

            {['recruiter', 'hiring_manager'].includes(form.relationshipType) && (
              <div className="form-group">
                <label className="form-label">Role You're Targeting <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="form-input"
                  name="roleApplying"
                  value={form.roleApplying}
                  onChange={handleChange}
                  placeholder="e.g. Software Engineer, Data Analyst"
                />
              </div>
            )}

            <button
              className="btn btn-ai"
              style={{ width: '100%', marginTop: 4 }}
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {isLoading ? 'Generating...' : '✨ Generate with AI'}
            </button>

            {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

            <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Rules applied by AI</div>
              <ul style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <li>Uses their name if provided</li>
                <li>References your specific context/reason</li>
                <li>No filler — no "looking forward to connecting"</li>
                {form.relationshipType === 'recruiter'
                  ? <li>Direct ask about the role or openings</li>
                  : <li>Opens a conversation, no immediate ask</li>
                }
                <li>Under 300 characters</li>
              </ul>
            </div>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Generated Note</h3>
              {note && (
                <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="ai-loading-bubble" style={{ width: '100%', maxWidth: '100%' }}>
                <div className="ai-spinner" />
                <span>Writing your connection note...</span>
              </div>
            ) : note ? (
              <>
                <div className="note-output">{note}</div>
                <div className={`char-count${isOver ? ' over' : ''}`}>
                  {charCount} / {MAX_CHARS} characters {isOver ? '⚠️ Over limit — regenerate' : '✓'}
                </div>

                <div className="tip-box" style={{ marginTop: 16 }}>
                  <div className="tip-title">What to do after they accept</div>
                  <ul className="tip-list">
                    {form.relationshipType === 'recruiter' ? (
                      <>
                        <li>Follow up in 1-2 days if no DM — don't wait</li>
                        <li>Send your resume and the specific role you want</li>
                        <li>If 3rd party recruiter: ask directly which company they're hiring for</li>
                      </>
                    ) : (
                      <>
                        <li>Start with a genuine question about their work</li>
                        <li>2-3 exchanges before mentioning your job search</li>
                        <li>Ask for advice, not a referral — easier to say yes</li>
                      </>
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <div className="note-output placeholder">
                Fill in the <strong>"Why are you reaching out?"</strong> field — that's what makes the note specific.
                Everything else is optional but helps.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
