import { useLayoutEffect, useRef, useState } from 'react'
import type { Chat } from '../../shared/types/chat'

interface SidebarProps {
  chats: Chat[]
  activeChatId: string | null
  searchQuery: string
  onSearchChange: (value: string) => void
  onCreateChat: () => void
  onSelectChat: (id: string) => void
  onRenameChat: (id: string, title: string) => void
  onDeleteChat: (id: string) => void
}

export const Sidebar = ({
  chats,
  activeChatId,
  searchQuery,
  onSearchChange,
  onCreateChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
}: SidebarProps) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  useLayoutEffect(() => {
    if (!listRef.current) {
      return
    }
    listRef.current.scrollTop = 0
  }, [activeChatId])

  const startEditing = (chat: Chat) => {
    setEditingId(chat.id)
    setDraftTitle(chat.title)
  }

  const confirmDelete = (chatId: string) => {
    const approved = window.confirm('Delete this chat and all its messages?')
    if (approved) {
      onDeleteChat(chatId)
    }
  }

  const submitRename = (chatId: string) => {
    onRenameChat(chatId, draftTitle)
    setEditingId(null)
    setDraftTitle('')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>GigaChat Console</h1>
        <button type="button" className="btn btn-primary" onClick={onCreateChat}>
          + New chat
        </button>
      </div>

      <label className="sidebar-search">
        <span>Search</span>
        <input
          type="search"
          placeholder="Title or message text"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <ul ref={listRef} className="chat-list">
        {chats.map((chat) => {
          const isActive = chat.id === activeChatId
          const isEditing = editingId === chat.id
          return (
            <li key={chat.id} className={`chat-list-item ${isActive ? 'active' : ''}`}>
              {isEditing ? (
                <div className="chat-item-edit">
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    autoFocus
                  />
                  <div className="chat-actions">
                    <button type="button" className="btn" onClick={() => submitRename(chat.id)}>
                      Save
                    </button>
                    <button type="button" className="btn" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="chat-select"
                    onClick={() => onSelectChat(chat.id)}
                    title={chat.title}
                  >
                    {chat.title}
                  </button>
                  <div className="chat-actions">
                    <button type="button" className="btn" onClick={() => startEditing(chat)}>
                      Rename
                    </button>
                    <button type="button" className="btn btn-danger" onClick={() => confirmDelete(chat.id)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
