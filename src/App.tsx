import { useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import { ChatWindow } from './widgets/chat/ChatWindow'
import { Composer } from './widgets/chat/Composer'
import { Sidebar } from './widgets/sidebar/Sidebar'
import { useChats } from './features/chats/useChats'
import { useStreamingChat } from './features/chat-stream/useStreamingChat'
import { hydrateState } from './features/chats/chatSlice'
import { loadPersistedState, savePersistedState } from './shared/lib/storage/chat-db'
import { loadActiveChatId, loadSettings, saveActiveChatId, saveSettings } from './shared/lib/storage/preferences'

function App() {
  const dispatch = useAppDispatch()
  const { filteredChats, activeChat, activeChatId, searchQuery, settings, createNewChat, selectChat, renameExistingChat, removeChat, setQuery, changeSettings } =
    useChats()
  const { isGenerating, sendMessage, stopGeneration } = useStreamingChat()
  const chats = useAppSelector((state) => state.chat.chats)
  const error = useAppSelector((state) => state.chat.error)
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    const bootstrap = async () => {
      const persisted = await loadPersistedState()
      if (persisted) {
        const preferredActive = loadActiveChatId()
        const preferredSettings = loadSettings()
        dispatch(
          hydrateState({
            chats: persisted.chats,
            activeChatId: preferredActive ?? persisted.activeChatId,
            settings: preferredSettings ?? persisted.settings,
          }),
        )
      }
      setBootstrapped(true)
    }

    void bootstrap()
  }, [dispatch])

  const persistedSnapshot = useMemo(
    () => ({
      chats,
      activeChatId,
      settings,
    }),
    [activeChatId, chats, settings],
  )

  useEffect(() => {
    if (!bootstrapped) {
      return
    }
    void savePersistedState(persistedSnapshot)
    saveActiveChatId(activeChatId)
    saveSettings(settings)
  }, [activeChatId, bootstrapped, persistedSnapshot, settings])

  return (
    <div className="layout">
      <Sidebar
        chats={filteredChats}
        activeChatId={activeChatId}
        searchQuery={searchQuery}
        onSearchChange={setQuery}
        onCreateChat={createNewChat}
        onSelectChat={selectChat}
        onRenameChat={renameExistingChat}
        onDeleteChat={removeChat}
      />
      <main className="main-panel">
        <ChatWindow chat={activeChat} isGenerating={isGenerating} error={error} onStop={stopGeneration} />
        <Composer
          isGenerating={isGenerating}
          settings={settings}
          onSettingsChange={changeSettings}
          onSend={sendMessage}
          onStop={stopGeneration}
        />
      </main>
    </div>
  )
}

export default App
