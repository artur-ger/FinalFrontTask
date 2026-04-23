import { useMemo } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import {
  createChat,
  deleteChat,
  renameChat,
  setActiveChat,
  setSearchQuery,
  updateSettings,
} from './chatSlice'
import type { ChatSettings } from '../../shared/types/chat'

export const useChats = () => {
  const dispatch = useAppDispatch()
  const chats = useAppSelector((state) => state.chat.chats)
  const activeChatId = useAppSelector((state) => state.chat.activeChatId)
  const searchQuery = useAppSelector((state) => state.chat.searchQuery)
  const settings = useAppSelector((state) => state.chat.settings)

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [activeChatId, chats],
  )

  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return chats
    }
    return chats.filter((chat) => {
      const byTitle = chat.title.toLowerCase().includes(query)
      const byMessages = chat.messages.some((message) => message.content.toLowerCase().includes(query))
      return byTitle || byMessages
    })
  }, [chats, searchQuery])

  return {
    chats,
    filteredChats,
    activeChat,
    activeChatId,
    searchQuery,
    settings,
    createNewChat: () => dispatch(createChat()),
    selectChat: (chatId: string) => dispatch(setActiveChat(chatId)),
    renameExistingChat: (chatId: string, title: string) => dispatch(renameChat({ chatId, title })),
    removeChat: (chatId: string) => dispatch(deleteChat(chatId)),
    setQuery: (query: string) => dispatch(setSearchQuery(query)),
    changeSettings: (next: Partial<ChatSettings>) => dispatch(updateSettings(next)),
  }
}
