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
            '**Temporary Network Notice**: The AI assistant service experienced a connection delay. Official baseline summary: ₹3,363.8 Cr allocated, ₹1,237.9 Cr disbursed (66.1% utilization across 231 MPs).',
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '620px', background: '#f8fafc' }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
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
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '16px', color: '#0f2744', letterSpacing: '0.02em' }}>
                  PRAHAR AI Assistant
                </span>
                <Tag color="success" style={{ borderRadius: 12, fontSize: '11px', fontWeight: 600, margin: 0 }}>
                  Anthropic/Fable5
                </Tag>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Grounded on 25,168 Official Works & ₹3,363.8 Cr Dataset
              </div>
            </div>
          </div>

          <Tooltip title="Clear chat history">
            <Button
              type="text"
              icon={<DeleteOutlined />}
              onClick={handleClear}
              style={{ color: '#64748b' }}
            />
          </Tooltip>
        </div>

        {/* Quick Prompts Bar */}
        <div
          style={{
            padding: '8px 16px',
            background: '#ffffff',
            borderBottom: '1px solid #f1f5f9',
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
                    background: isUser ? '#1e293b' : '#ffffff',
                    color: isUser ? '#f8fafc' : '#1e293b',
                    boxShadow: isUser ? 'none' : '0 2px 6px rgba(0, 0, 0, 0.04)',
                    border: isUser ? 'none' : '1px solid #e2e8f0',
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
                        style={{ fontSize: '11px', color: '#94a3b8', height: 22, padding: '0 4px' }}
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
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
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
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
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
