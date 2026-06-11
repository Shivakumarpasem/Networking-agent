// Shared helpers for turning a contact's message thread into AI context.

// Format the conversation thread with dates so the AI knows WHEN each
// message happened — without dates it assumes everything was sent today.
export function formatHistory(messages, contactName) {
  return messages
    .filter(m => ['sent', 'received', 'history'].includes(m.type))
    .map(m => {
      const date = new Date(m.timestamp).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
      if (m.type === 'sent') return `[${date}] You: ${m.content}`
      if (m.type === 'received') return `[${date}] ${contactName}: ${m.content}`
      return `[Prior conversation, pasted ${date}]\n${m.content}`
    })
    .join('\n\n')
}

// Number of consecutive sent messages since the last reply received.
export function countUnanswered(messages) {
  let count = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const t = messages[i].type
    if (t === 'sent') count++
    else if (t === 'received') break
  }
  return count
}

export function daysSince(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}
