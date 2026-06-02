import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import cors from 'cors'
import dotenv from 'dotenv'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const CONTACTS_FILE = join(DATA_DIR, 'contacts.json')
mkdirSync(DATA_DIR, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

if (!process.env.GEMINI_API_KEY) {
  console.warn('\n⚠️  WARNING: GEMINI_API_KEY not set in .env — AI features will not work.\n')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const SYSTEM_PROMPT = `You are a direct, honest career coach and networking expert. Your job is to help someone navigate their job search through strategic networking.

Core principles:
1. Be direct and specific. Give ready-to-send messages — no templates with [brackets].
2. No fake openers: never "I hope this message finds you well", "I just wanted to reach out", "I came across your profile", or any filler phrases.
3. Recruiters get a direct ask — they are paid to fill roles, be clear about what you want.
4. Engineers and hiring managers get a conversation opener — build rapport first, never ask for a referral or job immediately.
5. Keep messages under 150 words unless context requires more.
6. Tell the user when to stop. After 2 unanswered follow-ups, advise stopping.
7. Always include timing: when to send, how long to wait for a reply.
8. Be honest if the situation looks bad. No false hope.

Always respond with valid JSON only. No markdown code blocks, no explanation outside the JSON object.`

const REL = {
  recruiter: 'recruiter (their job is to place candidates — they want to hear from job seekers)',
  engineer: 'software engineer or technical peer',
  hiring_manager: 'hiring manager (direct decision-maker for a role)',
  other: 'professional contact',
}

// Sanitize control characters (newlines, tabs, etc.) inside JSON string values
// Gemini sometimes puts literal newlines inside strings which breaks JSON.parse
function sanitizeForJSON(str) {
  let inString = false
  let escaped = false
  let result = ''
  for (const char of str) {
    if (escaped)          { result += char; escaped = false; continue }
    if (char === '\\' && inString) { result += char; escaped = true; continue }
    if (char === '"')     { inString = !inString; result += char; continue }
    if (inString && char.charCodeAt(0) < 32) {
      if (char === '\n')  { result += '\\n'; continue }
      if (char === '\r')  { result += '\\r'; continue }
      if (char === '\t')  { result += '\\t'; continue }
      continue // drop other control chars
    }
    result += char
  }
  return result
}

// For coach-chat: strip markdown/JSON artifacts and return clean text
function cleanCoachResponse(text) {
  let msg = text.trim()

  // Strip outer markdown code block (```json ... ``` or ``` ... ```)
  const blockMatch = msg.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (blockMatch) {
    const inner = blockMatch[1].trim()
    // If the inner content is JSON, extract the most relevant text field
    try {
      const parsed = JSON.parse(sanitizeForJSON(inner))
      return (parsed.message || parsed.advice || parsed.text ||
              parsed.suggestion || Object.values(parsed)[0] || inner).toString().trim()
    } catch {
      return inner
    }
  }

  // If the whole response looks like JSON (starts with {), try to extract text
  if (msg.startsWith('{')) {
    try {
      const parsed = JSON.parse(sanitizeForJSON(msg))
      return (parsed.message || parsed.advice || parsed.text ||
              parsed.suggestion || Object.values(parsed)[0] || msg).toString().trim()
    } catch {}
  }

  return msg
}

function extractJSON(text) {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const raw = (block ? block[1] : text).trim()

  // 1. Try direct parse
  try { return JSON.parse(raw) } catch {}

  // 2. Try extracting just the {...} object
  const objMatch = raw.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch {}
    // 3. Sanitize control characters and try again
    try { return JSON.parse(sanitizeForJSON(objMatch[0])) } catch {}
  }

  throw new Error('Could not parse AI response as JSON')
}

// ── Contacts storage endpoints ───────────────────────────────────────────────
app.get('/api/contacts', (req, res) => {
  try {
    if (!existsSync(CONTACTS_FILE)) return res.json({ success: true, contacts: [] })
    const contacts = JSON.parse(readFileSync(CONTACTS_FILE, 'utf8'))
    res.json({ success: true, contacts })
  } catch {
    res.json({ success: true, contacts: [] })
  }
})

app.put('/api/contacts', (req, res) => {
  try {
    writeFileSync(CONTACTS_FILE, JSON.stringify(req.body.contacts || [], null, 2))
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

async function callGemini(prompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

app.post('/api/suggest', async (req, res) => {
  try {
    const { type, contact, context } = req.body
    const relDesc = REL[contact.relationshipType] || 'professional contact'
    const who = `Contact: ${contact.name}
Title/Company: ${[contact.jobTitle, contact.company].filter(Boolean).join(' at ') || 'Unknown'}
Relationship: ${relDesc}`

    let prompt = ''

    if (type === 'analyze-history') {
      prompt = `${who}

Existing conversation history:
---
${context.history}
---

Analyze this conversation and suggest the single best next message to send.

Return JSON only (no markdown):
{"suggestion":"[exact message, ready to send]","tone":"Direct|Professional|Casual|Warm","timing":"[e.g., Send today, or wait 2 days]","advice":"[1-2 sentence coaching note]","shouldStop":false}`

    } else if (type === 'after-sent') {
      prompt = `${who}

Message just sent:
"${context.sentMessage}"

Prior conversation:
${context.conversationHistory || 'This was the first message.'}

Give a follow-up message to use if there is no reply, and tell me when to send it.

Return JSON only:
{"suggestion":"[exact follow-up message if no reply]","tone":"Direct|Professional|Casual|Warm","timing":"[e.g., Follow up in 5 days if no reply]","waitDays":5,"advice":"[1-2 sentence coaching note]","shouldStop":false}`

    } else if (type === 'after-reply') {
      prompt = `${who}

Full conversation:
${context.conversationHistory}

Their reply just received:
"${context.theirReply}"

Assess their reply and give me the best next message to send.

Return JSON only:
{"sentiment":"Positive|Neutral|Negative|Interested|Brushing off","suggestion":"[exact next message]","tone":"Direct|Professional|Casual|Warm","timing":"[when to send]","advice":"[1-2 sentence coaching note]","shouldStop":false}`

    } else if (type === 'no-reply') {
      prompt = `${who}

Days since last message: ${context.daysSince}
Last message sent: "${context.lastMessage}"
Number of messages sent without a reply: ${context.unansweredCount}

Should I follow up or stop messaging this person?

Return JSON only:
{"suggestion":"[exact follow-up message, or empty string if should stop]","timing":"[advice on timing]","advice":"[direct, honest coaching — 1-2 sentences]","shouldStop":${context.unansweredCount >= 2}}`

    } else if (type === 'manual-suggest') {
      prompt = `${who}
Current status: ${context.status}

Full conversation history:
${context.conversationHistory || 'No messages yet.'}

What should I do next with this contact?

Return JSON only:
{"suggestion":"[exact next message, ready to send]","tone":"Direct|Professional|Casual|Warm","timing":"[when to send]","advice":"[1-2 sentence coaching note]","shouldStop":false}`

    } else if (type === 'note-generator') {
      prompt = `Write a LinkedIn connection request note.

About this person:
- Name: ${context.personName || 'unknown (do not use a name placeholder)'}
- LinkedIn headline: ${context.headline || 'not provided'}
- Job title: ${context.jobTitle || 'not provided'}
- Company: ${context.company || 'not provided'}
- Relationship type: ${relDesc}
${context.roleApplying ? `- Role I am targeting: ${context.roleApplying}` : ''}

WHY I am reaching out (this is the most important field — the note MUST reference this):
"${context.context || 'not provided'}"

STRICT RULES — violating any of these is a failure:
1. Under 300 characters — hard limit, count every character before finishing
2. ${context.personName ? `The person's first name is "${context.personName}". Begin the note with "Hi ${context.personName}," — use the actual name, never write [Name] or any bracket or placeholder` : 'No name provided — do not use any name placeholder like [Name]'}
3. Your note MUST directly reference this specific context: "${context.context || 'none'}" — do not write a generic note
4. BANNED phrases (do not use any of these): "just wanted to connect", "looking forward to connecting", "hope this finds you", "came across your profile", "interested in connecting", "would love to connect"
5. ${relDesc.includes('recruiter') ? `They are a recruiter — ask directly about the specific role or opening mentioned in the context. Be clear you are a candidate.` : `They are not a recruiter — open a real conversation based on the context, do NOT ask for a job or referral`}
6. Write like a real person, not a template. Every word must earn its place.
7. The final note must contain zero brackets [] or parentheses used as placeholders

Return JSON only (no markdown):
{"note":"[write the actual note here — real words, no placeholders]"}`

    } else if (type === 'coach-chat') {
      const prevExchange = (context.chatHistory || []).slice(0, -1)
        .map(m => `${m.role === 'user' ? 'You' : 'Coach'}: ${m.content}`)
        .join('\n\n')
      const latestMsg = (context.chatHistory || []).at(-1)?.content || ''

      prompt = `You are coaching someone on their job search networking. Be direct and give specific, actionable advice — like a blunt friend who knows hiring.

WHO THEY ARE NETWORKING WITH:
- Name: ${contact.name}
- Their role: ${relDesc}
${contact.jobTitle ? `- Job title: ${contact.jobTitle}` : ''}
${contact.company ? `- Company: ${contact.company}` : ''}
- Pipeline status: ${context.status || 'New'}

FULL CONVERSATION THREAD BETWEEN USER AND ${contact.name}:
${context.conversationHistory || 'No messages yet — fresh contact with no history.'}

${prevExchange ? `COACHING CONVERSATION SO FAR:\n${prevExchange}\n` : ''}
USER ASKS: "${latestMsg}"

RESPONSE RULES:
1. Give a direct, specific answer — no "it depends" without also giving your actual recommendation
2. If they ask "is this going well?" — actually read the messages above and give your real honest read
3. If they need a message written — write the exact message, no [brackets], no "something like this"
4. If they ask what to do next — give ONE clear action with a reason, not a list of options
5. Reference the actual content of their conversation when relevant — show you read it
6. DO NOT start with "Great question!", "Absolutely!", "Of course!", or any affirmation filler
7. Under 200 words unless the question genuinely needs more
8. End with one concrete next step or recommendation

Write in plain conversational text. No JSON, no markdown headers, no ** bold **.`

      const coachRaw = await callGemini(prompt)
      const message = coachRaw.replace(/^```[\s\S]*?```$/gm, '').trim()
      return res.json({ success: true, data: { message } })

    } else if (type === 'first-message') {
      prompt = `Write the first outreach message to a new contact.

CONTACT:
- Name: ${contact.name}
- Their role: ${relDesc}
${contact.jobTitle ? `- Job title: ${contact.jobTitle}` : ''}
${contact.company ? `- Company: ${contact.company}` : ''}

WHY I WANT TO REACH OUT (use this — do not write a generic message):
"${context.context}"

RULES:
1. Under 150 words
2. No "I hope this finds you well", "I just wanted to reach out", "I wanted to connect"
3. If recruiter: be clear about what type of role you're looking for — they want to know
4. If engineer or hiring manager: open a genuine conversation, do NOT ask for a job or referral yet
5. Reference the specific reason above — make it personal to this person
6. Write the actual message — no [brackets] or placeholders

Return JSON only:
{"message":"[exact message to send]","tone":"Direct|Warm|Professional","timing":"send now|wait X days","advice":"[one coaching tip]"}`
    }

    const raw = await callGemini(prompt)
    const parsed = extractJSON(raw)

    if (type === 'note-generator' && parsed.note) {
      parsed.charCount = parsed.note.length
    }

    res.json({ success: true, data: parsed })
  } catch (err) {
    console.error('AI error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`\n🚀 AI server running on http://localhost:${PORT}\n`))
