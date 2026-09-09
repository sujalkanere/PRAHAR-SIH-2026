import { apiClient } from './client'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  ok: boolean
  reply: string
  model_used: string
  error?: string
}

export const chatApi = {
  sendMessage: async (messages: ChatMessage[], context?: Record<string, any>): Promise<ChatResponse> => {
    const res = await apiClient.post<ChatResponse>('/ai/chat', {
      messages,
      context,
    })
    return res.data
  },
}
