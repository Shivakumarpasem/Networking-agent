async function post(type, contact, context) {
  // 1. Network error (server not running)
  let res
  try {
    res = await fetch('/api/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, contact, context }),
    })
  } catch {
    throw new Error('Cannot connect to AI server. Make sure it is running — open a terminal in the project folder and run: npm run dev')
  }

  // 2. Server returned non-JSON (HTML error page, empty body, etc.)
  const text = await res.text()
  if (!text || !text.trim()) {
    throw new Error('AI server returned an empty response. The server may have crashed — check the terminal.')
  }

  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('AI server returned an unexpected response. Check the server terminal for errors.')
  }

  // 3. Server returned { success: false, error: "..." }
  if (!json.success) throw new Error(json.error || 'AI request failed')

  return json.data
}

export const analyzeHistory = (contact, history) =>
  post('analyze-history', contact, { history })

export const suggestAfterSent = (contact, sentMessage, conversationHistory) =>
  post('after-sent', contact, { sentMessage, conversationHistory })

export const suggestAfterReply = (contact, theirReply, conversationHistory) =>
  post('after-reply', contact, { theirReply, conversationHistory })

export const suggestNoReply = (contact, daysSince, lastMessage, unansweredCount) =>
  post('no-reply', contact, { daysSince, lastMessage, unansweredCount })

export const manualSuggest = (contact, conversationHistory, status) =>
  post('manual-suggest', contact, { conversationHistory, status })

export const generateNote = (contact, context) =>
  post('note-generator', contact, context)

export const coachChat = (contact, conversationHistory, chatHistory) =>
  post('coach-chat', contact, { conversationHistory, chatHistory })

export const followUpTriage = (contact, conversationHistory, daysSince, unansweredCount) =>
  post('follow-up-triage', contact, { conversationHistory, daysSince, unansweredCount })

export const firstMessage = (contact, context) =>
  post('first-message', contact, { context })
