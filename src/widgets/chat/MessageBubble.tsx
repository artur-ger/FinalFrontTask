import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import type { Message } from '../../shared/types/chat'

interface MessageBubbleProps {
  message: Message
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isAssistant = message.role === 'assistant'
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'error'>('idle')

  useEffect(() => {
    if (copyState === 'idle') {
      return
    }
    const timer = window.setTimeout(() => setCopyState('idle'), 1200)
    return () => window.clearTimeout(timer)
  }, [copyState])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopyState('ok')
    } catch (error) {
      console.error('Failed to copy message', error)
      setCopyState('error')
    }
  }

  return (
    <article className={`message ${isAssistant ? 'assistant' : 'user'}`}>
      <header className="message-head">
        <strong>{isAssistant ? 'Assistant' : 'You'}</strong>
        {isAssistant && (
          <button type="button" className="btn" onClick={onCopy}>
            {copyState === 'ok' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy'}
          </button>
        )}
      </header>

      {message.images && message.images.length > 0 && (
        <div className="image-grid">
          {message.images.map((image) => (
            <img key={image} src={image} alt="Uploaded content" />
          ))}
        </div>
      )}

      <div className="message-body markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize, rehypeHighlight]}>
          {message.content || (message.streaming ? '...' : '')}
        </ReactMarkdown>
      </div>
    </article>
  )
}
