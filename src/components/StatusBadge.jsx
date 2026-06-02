const STATUS_CONFIG = {
  'New':            { icon: '○', cls: 'New' },
  'Message Sent':   { icon: '→', cls: 'Message-Sent' },
  'Awaiting Reply': { icon: '⏳', cls: 'Awaiting-Reply' },
  'Reply Received': { icon: '✓', cls: 'Reply-Received' },
  'Follow Up Due':  { icon: '!', cls: 'Follow-Up-Due' },
  'Closed':         { icon: '×', cls: 'Closed' },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['New']
  return (
    <span className={`status-badge ${cfg.cls}`}>
      <span>{cfg.icon}</span> {status}
    </span>
  )
}
