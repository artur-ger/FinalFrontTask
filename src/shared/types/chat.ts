export type Role = 'system' | 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  createdAt: number
  images?: string[]
  streaming?: boolean
}

export interface Chat {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
}

export interface ChatSettings {
  model: string
  system_prompt: string
  temperature: number
  top_p: number
  max_tokens: number
  repetition_penalty: number
}

export interface ChatState {
  chats: Chat[]
  activeChatId: string | null
  searchQuery: string
  settings: ChatSettings
  isGenerating: boolean
  error: string | null
}

export interface PersistedState {
  chats: Chat[]
  activeChatId: string | null
  settings: ChatSettings
}
