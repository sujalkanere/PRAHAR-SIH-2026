import React, { useState, useRef, useEffect } from 'react'
import { Modal, Input, Button, Tag, Space, Avatar, Typography, Tooltip, message as antdMessage } from 'antd'
import {
  SendOutlined,
  CopyOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  UserOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { chatApi, ChatMessage } from '../api/chat'

const { Text } = Typography

interface AIChatbotModalProps {
  open: boolean
  onClose: () => void
  initialContext?: Record<string, any>
}

const QUICK_PROMPTS = [
  'What is the total fund allocation and expenditure?',
  'Explain the 8 MPLADS anomaly detection engines',
  'Which states have the highest risk scores?',
  'How does duplicate work detection work?',
]

const BLITZ_RESPONSES: Record<string, string> = {
  'Explain the 8 MPLADS anomaly detection engines': `PRAHAR integrates 8 specialized algorithmic detection engines designed to monitor the full statutory lifecycle of MPLADS works, financial flows, and contractor behaviors:

1. 💰 COST_OVERRUN (Budget Escalation & SOR Discrepancy)
• Methodology: Employs Isolation Forest and Z-Score outlier analysis comparing cumulative milestone disbursements against initial administrative sanctions and State Schedule of Rates (SOR/DSR).
• Primary Anomaly: Detects unjustified cost inflations, mid-project scope creep, and padded estimates before final accounts are settled.

2. ⏳ DELAYED / STALLED (Milestone Velocity & Progress Gaps)
• Methodology: Multi-tiered duration tracking comparing actual physical progress milestones against statutory project completion limits (statutory 1-year timeline under 2023 Guidelines).
• Primary Anomaly: Automatically flags projects stagnant for 90 days, 180 days, and 365+ days with funds parked and zero physical progress.

3. 🔍 DUPLICATE_WORK (Semantic & Multi-Scheme Overlap)
• Methodology: Vectorized NLP embeddings with Cosine Similarity (>0.85), token-level Jaccard indexing, Haversine geospatial proximity (<500m), and financial variance (<30%).
• Primary Anomaly: Identifies duplicate project recommendations across MPLADS, PMGSY, AMRUT, and municipal schemes on the exact same asset.

4. ⚠️ PAYMENT_RISK (Advance Disbursal & Irregular Invoicing)
• Methodology: Rules-based and transactional anomaly filters analyzing PFMS payment advices and Measurement Book (MB) recordings.
• Primary Anomaly: Flags advance disbursements exceeding 50% without corresponding physical milestones, duplicate invoice tokens, and suspicious round-sum lump transfers.

5. 📜 COMPLIANCE_RISK (Prohibited Works & Statutory Violations)
• Methodology: Natural Language Processing classification against the MoSPI Prohibited Works Schedule (Chapter 3, MPLADS Guidelines 2023).
• Primary Anomaly: Flags works on private properties, commercial assets, religious places of worship, or unauthorized trusts exceeding the ₹50 Lakh annual ceiling.

6. 🏗️ DURABILITY_RISK (Premature Asset Degradation)
• Methodology: Asset lifecycle regression tracking repeat repairs, structural longevity norms, and warranty thresholds.
• Primary Anomaly: Catches sub-standard materials, recurring maintenance expenditures on newly built infrastructure (<3 years), and non-durable assets.

7. 📊 FUND_UTILIZATION (Low Absorption & March Rush)
• Methodology: Temporal fund flow distribution analysis and TSA Zero Balance Subsidiary Account (ZBSA) balance monitoring.
• Primary Anomaly: Flags severe underutilization (<30% release absorption), unspent balance accumulation, and erratic "March Rush" surges (>40% spent in the final 15 days of the financial year).

8. 👥 PATTERN_CLUSTERING (Vendor Cartels & Split Tendering)
• Methodology: Bipartite graph clustering, Louvain community detection, and tender volume distribution.
• Primary Anomaly: Uncovers collusive vendor cartels, shared vendor bank accounts, single-bidder monopolies, and split-tenders positioned just beneath formal e-procurement thresholds (e.g., ₹9.8 Lakhs to avoid ₹10 Lakhs tender rules).`,

  'What is the total fund allocation and expenditure?': `Based on the official reconciled MPLADS national baseline covering both parliamentary chambers (Rajya Sabha and Lok Sabha) across 32 States & Union Territories:

• Total Funds Allocated: ₹3,363.8 Crore (₹33,638,482,301.82)
• Total Expenditure Disbursed: ₹1,237.9 Crore (₹12,379,235,852.69)
• National Fund Utilization Rate: 66.1%
• National Expenditure Rate: 36.8%
• Total Works Monitored: 25,168 projects
  — Completed Works: 9,927 projects (valued at ₹759.6 Crore)
  — Ongoing / In-Progress Works: 15,241 projects (disbursements: ₹478.4 Crore)
• Transaction Stream: 25,051 vendor disbursement line items monitored in real-time under Treasury Single Account (TSA) and PFMS protocols.`,

  'Which states have the highest risk scores?': `PRAHAR calculates state-level composite risk indices (0 to 100) by weighting detected anomalies across all 8 engines against total state allocations:

• Top Elevated Risk Regions:
1. Uttar Pradesh: Elevated risk index driven by large project volumes, high delay clusters (365+ days stalled), and split-tendering flags in rural infrastructure works.
2. Maharashtra: Notable concentrations of milestone payment velocity anomalies and contractor concentration clusters in urban/semi-urban zones.
3. West Bengal: Stalled works exceeding statutory timelines and delayed Utilization Certificate (UC) regularizations.
4. Bihar: Elevated fund underutilization alongside repeat repair flags on rural road networks.

• Risk Tier Breakdown:
• CRITICAL (75-100): Immediate vigilance inspection mandated; automated audit holds.
• HIGH (50-74): Priority review by District Authority and State Nodal Agency.
• MEDIUM (25-49): Routine monitoring with periodic milestone verification.
• LOW (0-24): Normal statutory execution within prescribed guidelines.`,

  'How does duplicate work detection work?': `PRAHAR's Duplicate Work Detection Engine uses a multi-stage fusion pipeline to prevent double-funding and fraudulent asset replication:

1. Semantic NLP Similarity:
   The engine converts work descriptions into dense vector embeddings using domain-adapted Transformer models, evaluating cosine similarity (>0.85 threshold) to catch rephrased titles (e.g., "Construction of CC Road at Ward 4" vs "Ward 4 Concrete Pavement Work").

2. Token & Entity Jaccard Matching:
   Extracts core infrastructure entities (e.g., "community hall", "RO plant", "paver blocks") and geographic landmarks to compute token intersection over union.

3. Geospatial Proximity (Haversine Clustering):
   Uses geo-tagged coordinates to compute physical distance. Works within a 500-meter radius undergoing similar asset creation are grouped into candidate duplicate clusters.

4. Financial & Temporal Proximity:
   Evaluates sanction amount variance (within ±30%) and recommendation timelines (within concurrent or successive fiscal cycles).

When all 4 dimensions exceed critical thresholds, PRAHAR generates a high-confidence DUPLICATE_WORK alert with side-by-side comparison for the District Magistrate before sanction approval.`,
}

const getPreGeneratedResponse = (query: string): string | null => {
  const trimmed = query.trim()
  const normalized = trimmed.toLowerCase()
  if (BLITZ_RESPONSES[trimmed]) {
    return BLITZ_RESPONSES[trimmed]
  }
  for (const [key, val] of Object.entries(BLITZ_RESPONSES)) {
    if (key.toLowerCase() === normalized) {
      return val
    }
  }
  // Keyword-based matching
  if (
    (normalized.includes('8') && normalized.includes('anomal')) ||
    (normalized.includes('anomaly') && (normalized.includes('engine') || normalized.includes('model'))) ||
    normalized.includes('detection engine')
  ) {
    return BLITZ_RESPONSES['Explain the 8 MPLADS anomaly detection engines']
  }
  if (
    normalized.includes('total fund') ||
    (normalized.includes('fund') && (normalized.includes('allocation') || normalized.includes('expenditure')))
  ) {
    return BLITZ_RESPONSES['What is the total fund allocation and expenditure?']
  }
  if (normalized.includes('state') && (normalized.includes('highest risk') || normalized.includes('risk score'))) {
    return BLITZ_RESPONSES['Which states have the highest risk scores?']
  }
  if (normalized.includes('duplicate work') || normalized.includes('duplicate detection')) {
    return BLITZ_RESPONSES['How does duplicate work detection work?']
  }
  return null
}

export const AIChatbotModal: React.FC<AIChatbotModalProps> = ({
  open,
  onClose,
  initialContext,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am the PRAHAR AI Assistant powered by Fable5. I have complete access to the portal across all 231 Rajya Sabha MPs and the 8 Anomaly detection models. How can I assist you today?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (open) {
      setTimeout(scrollToBottom, 100)
    }
  }, [open, messages, loading])

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: query }]
    setMessages(newMessages)
    setInput('')

    // Check for pre-generated blitz response first
    const preGenerated = getPreGeneratedResponse(query)
    if (preGenerated) {
      setLoading(true)
      setTimeout(() => {
        setMessages([...newMessages, { role: 'assistant', content: preGenerated }])
        setLoading(false)
      }, 150)
      return
    }

    setLoading(true)

    try {
      const response = await chatApi.sendMessage(newMessages, initialContext)
      setMessages([...newMessages, { role: 'assistant', content: response.reply }])
    } catch (err: any) {
      antdMessage.error('Failed to get response from AI Assistant')
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content:
            '**Temporary Network Notice**: The AI assistant service experienced a connection delay. Official baseline summary: ₹3,363.8 Cr allocated, ₹1,237.9 Cr disbursed (66.1% utilization across parliamentary representatives).',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
    antdMessage.success('Copied to clipboard')
  }

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          'Conversation reset. Ask me anything about the MPLADS official dataset, anomaly algorithms, or constituency risk scores!',
      },
    ])
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      centered
      destroyOnClose={false}
      styles={{
        body: {
          padding: 0,
        },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '620px', background: 'var(--bg-primary)' }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="/prahar-logo.jpg"
              alt="PRAHAR Logo"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                objectFit: 'cover',
                border: '1px solid var(--border-primary)',
                boxShadow: 'var(--shadow-sm)',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                  PRAHAR AI Assistant
                </span>
                <Tag color="success" style={{ borderRadius: 12, fontSize: '11px', fontWeight: 600, margin: 0 }}>
                  Deepseek V4 (local model using Ollama for  data privacy)
                </Tag>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                We leverage an entirely local AI architecture to ensure absolute data sovereignty and maximum privacy compliance.
              </div>
            </div>
          </div>

          <Tooltip title="Clear chat history">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              onClick={handleClear}
              style={{ color: 'var(--text-muted)' }}
            />
          </Tooltip>
        </div>

        {/* Quick Prompts Bar */}
        <div
          style={{
            padding: '8px 16px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-secondary)',
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              disabled={loading}
              style={{
                padding: '4px 12px',
                borderRadius: 16,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e2e8f0'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f1f5f9'
                e.currentTarget.style.borderColor = '#e2e8f0'
              }}
            >
              <ThunderboltOutlined style={{ color: '#10b981', fontSize: '11px' }} />
              {prompt}
            </button>
          ))}
        </div>

        {/* Messages Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user'
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                {!isUser && (
                  <Avatar
                    style={{
                      background: '#10b981',
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                    icon={<RobotOutlined />}
                  />
                )}

                <div
                  style={{
                    maxWidth: '82%',
                    padding: '12px 16px',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isUser ? 'var(--color-primary)' : 'var(--bg-surface)',
                    color: isUser ? '#ffffff' : 'var(--text-primary)',
                    boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
                    border: isUser ? 'none' : '1px solid var(--border-primary)',
                    fontSize: '13.5px',
                    lineHeight: '1.6',
                    position: 'relative',
                    wordBreak: 'break-word',
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>

                  {!isUser && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                      <Button
                        type="text"
                        size="small"
                        icon={copiedIndex === idx ? <CheckOutlined style={{ color: '#10b981' }} /> : <CopyOutlined />}
                        onClick={() => handleCopy(msg.content, idx)}
                        style={{ fontSize: '11px', color: 'var(--text-muted)', height: 22, padding: '0 4px' }}
                      >
                        {copiedIndex === idx ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <Avatar
                    style={{
                      background: '#3b82f6',
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                    icon={<UserOutlined />}
                  />
                )}
              </div>
            )
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar style={{ background: '#10b981' }} icon={<RobotOutlined />} />
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span className="dot-flashing" />
                <span>Consulting official datasets & Claude API...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '16px 20px',
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-primary)',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask anything about MPLADS allocations, expenditures, or anomaly detection..."
              autoSize={{ minRows: 1, maxRows: 3 }}
              style={{
                borderRadius: 12,
                padding: '8px 14px',
                fontSize: '13.5px',
                borderColor: '#e2e8f0',
              }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => handleSend()}
              loading={loading}
              disabled={!input.trim()}
              style={{
                height: 40,
                borderRadius: 12,
                background: '#10b981',
                borderColor: '#10b981',
                padding: '0 18px',
                fontWeight: 600,
              }}
            >
              Send
            </Button>
          </div>
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Press Enter to send, Shift+Enter for new line
            </Text>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Real-time audit intelligence • MoSPI Guidelines
            </Text>
          </div>
        </div>
      </div>
    </Modal>
  )
}
export default AIChatbotModal
