import { useLayoutEffect, useRef } from 'react'
import type { Chat } from '../../shared/types/chat'
import { MessageBubble } from './MessageBubble'

interface ChatWindowProps {
  chat: Chat | null
  isGenerating: boolean
  error: string | null
  onStop: () => void
}

export const ChatWindow = ({ chat, isGenerating, error, onStop }: ChatWindowProps) => {
  const bottomRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLElement>(null)
  const prevChatIdRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    const isChatSwitch = prevChatIdRef.current !== (chat?.id ?? null)
    prevChatIdRef.current = chat?.id ?? null

    const behavior: ScrollBehavior = isChatSwitch ? 'auto' : 'smooth'
    const scrollToBottom = () => {
      const container = windowRef.current
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior,
        })
      }
      bottomRef.current?.scrollIntoView({ block: 'end', behavior })
    }

    scrollToBottom()
    const frame = window.requestAnimationFrame(scrollToBottom)
    return () => window.cancelAnimationFrame(frame)
  }, [chat?.id, chat?.messages.length, isGenerating])

  if (!chat) {
    return (
      <section className="chat-window empty">
        <p>Select a chat on the left to continue.</p>
      </section>
    )
  }

  return (
    <section ref={windowRef} className="chat-window">
      <div className="messages">
        {chat.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isGenerating && <div className="typing-indicator">Assistant is typing...</div>}
        {error && <div className="error-banner">{error}</div>}
        {isGenerating && (
          <button type="button" className="btn btn-danger chat-stop-floating" onClick={onStop}>
            Stop generation
          </button>
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  )
}
