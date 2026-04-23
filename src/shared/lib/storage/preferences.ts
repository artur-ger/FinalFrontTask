import type { ChatSettings } from '../../types/chat'

const ACTIVE_CHAT_KEY = 'gigachat.activeChatId'
const SETTINGS_KEY = 'gigachat.settings'

export const saveActiveChatId = (chatId: string | null): void => {
  if (chatId) {
    localStorage.setItem(ACTIVE_CHAT_KEY, chatId)
    return
  }
  localStorage.removeItem(ACTIVE_CHAT_KEY)
}

export const loadActiveChatId = (): string | null => localStorage.getItem(ACTIVE_CHAT_KEY)

export const saveSettings = (settings: ChatSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export const loadSettings = (): ChatSettings | null => {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as ChatSettings
  } catch {
    return null
  }
}
