import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Chat, ChatSettings, ChatState, Message, PersistedState } from '../../shared/types/chat'

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const createEmptyChat = (title = 'New chat'): Chat => {
  const now = Date.now()
  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

const defaultSettings: ChatSettings = {
  model: 'GigaChat-2-Max',
  system_prompt: 'Ты полезный ассистент. Отвечай структурировано и по делу.',
  temperature: 1,
  top_p: 0.9,
  max_tokens: 1024,
  repetition_penalty: 1,
}

const initialChat = createEmptyChat()

const initialState: ChatState = {
  chats: [initialChat],
  activeChatId: initialChat.id,
  searchQuery: '',
  settings: defaultSettings,
  isGenerating: false,
  error: null,
}

interface ChatWithMessagePayload {
  chatId: string
  message: Message
}

interface AppendChunkPayload {
  chatId: string
  messageId: string
  chunk: string
}

interface RenamePayload {
  chatId: string
  title: string
}

const trimTitle = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, 48)

const getChatById = (state: ChatState, chatId: string): Chat | undefined =>
  state.chats.find((chat) => chat.id === chatId)

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    hydrateState: (state, action: PayloadAction<PersistedState>) => {
      if (action.payload.chats.length === 0) {
        return state
      }

      state.chats = action.payload.chats
      state.activeChatId = action.payload.activeChatId ?? action.payload.chats[0].id
      state.settings = action.payload.settings
    },
    createChat: (state) => {
      const next = createEmptyChat()
      state.chats.unshift(next)
      state.activeChatId = next.id
      state.searchQuery = ''
    },
    setActiveChat: (state, action: PayloadAction<string>) => {
      state.activeChatId = action.payload
    },
    renameChat: (state, action: PayloadAction<RenamePayload>) => {
      const chat = getChatById(state, action.payload.chatId)
      if (!chat) {
        return
      }
      const nextTitle = trimTitle(action.payload.title)
      if (nextTitle.length > 0) {
        chat.title = nextTitle
      }
      chat.updatedAt = Date.now()
    },
    deleteChat: (state, action: PayloadAction<string>) => {
      state.chats = state.chats.filter((chat) => chat.id !== action.payload)

      if (state.chats.length === 0) {
        const next = createEmptyChat()
        state.chats.push(next)
        state.activeChatId = next.id
        return
      }

      if (state.activeChatId === action.payload) {
        state.activeChatId = state.chats[0].id
      }
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },
    updateSettings: (state, action: PayloadAction<Partial<ChatSettings>>) => {
      state.settings = {
        ...state.settings,
        ...action.payload,
      }
    },
    addUserMessage: (state, action: PayloadAction<ChatWithMessagePayload>) => {
      const chat = getChatById(state, action.payload.chatId)
      if (!chat) {
        return
      }
      chat.messages.push(action.payload.message)
      chat.updatedAt = Date.now()

      if (chat.title === 'New chat') {
        const generated = trimTitle(action.payload.message.content)
        if (generated.length > 0) {
          chat.title = generated
        } else if (action.payload.message.images && action.payload.message.images.length > 0) {
          chat.title = 'Image chat'
        }
      }
    },
    startAssistantMessage: (state, action: PayloadAction<ChatWithMessagePayload>) => {
      const chat = getChatById(state, action.payload.chatId)
      if (!chat) {
        return
      }
      chat.messages.push(action.payload.message)
      chat.updatedAt = Date.now()
    },
    appendAssistantChunk: (state, action: PayloadAction<AppendChunkPayload>) => {
      const chat = getChatById(state, action.payload.chatId)
      if (!chat) {
        return
      }
      const message = chat.messages.find((msg) => msg.id === action.payload.messageId)
      if (!message) {
        return
      }
      message.content += action.payload.chunk
      chat.updatedAt = Date.now()
    },
    finishAssistantMessage: (state, action: PayloadAction<{ chatId: string; messageId: string }>) => {
      const chat = getChatById(state, action.payload.chatId)
      if (!chat) {
        return
      }
      const message = chat.messages.find((msg) => msg.id === action.payload.messageId)
      if (message) {
        message.streaming = false
      }
      chat.updatedAt = Date.now()
    },
    setGenerating: (state, action: PayloadAction<boolean>) => {
      state.isGenerating = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
  },
})

export const {
  hydrateState,
  createChat,
  setActiveChat,
  renameChat,
  deleteChat,
  setSearchQuery,
  updateSettings,
  addUserMessage,
  startAssistantMessage,
  appendAssistantChunk,
  finishAssistantMessage,
  setGenerating,
  setError,
} = chatSlice.actions

export default chatSlice.reducer
