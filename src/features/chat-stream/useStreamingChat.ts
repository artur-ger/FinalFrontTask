import { useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import {
  addUserMessage,
  appendAssistantChunk,
  setError,
  setGenerating,
  startAssistantMessage,
  finishAssistantMessage,
} from '../chats/chatSlice'
import { streamChatCompletion } from '../../shared/lib/api/gigachat'
import type { ChatSettings, Message } from '../../shared/types/chat'

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useStreamingChat = () => {
  const dispatch = useAppDispatch()
  const activeChat = useAppSelector((state) => {
    const activeId = state.chat.activeChatId
    return state.chat.chats.find((chat) => chat.id === activeId) ?? null
  })
  const settings = useAppSelector((state) => state.chat.settings)
  const isGenerating = useAppSelector((state) => state.chat.isGenerating)

  const controllerRef = useRef<AbortController | null>(null)

  const hasImagesInContext = (messages: Message[]): boolean =>
    messages.some((message) => message.role === 'user' && Array.isArray(message.images) && message.images.length > 0)

  const resolveSettingsForRequest = (base: ChatSettings, shouldUseMultimodalModel: boolean): ChatSettings => {
    if (!shouldUseMultimodalModel) {
      return base
    }
    // Multimodal requests should always use a model that supports image input.
    return {
      ...base,
      model: 'GigaChat-2-Max',
    }
  }

  const stopGeneration = (): void => {
    controllerRef.current?.abort()
    controllerRef.current = null
    dispatch(setGenerating(false))
  }

  const sendMessage = async (content: string, images: string[] = []): Promise<void> => {
    const trimmedContent = content.trim()
    const hasImages = images.length > 0

    if (!activeChat || isGenerating || (!trimmedContent && !hasImages)) {
      return
    }

    const now = Date.now()
    const chatId = activeChat.id
    const userMessage: Message = {
      id: createId(),
      role: 'user',
      content: trimmedContent,
      images,
      createdAt: now,
    }
    const assistantId = createId()
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: now + 1,
      streaming: true,
    }

    dispatch(setError(null))
    dispatch(addUserMessage({ chatId, message: userMessage }))
    dispatch(startAssistantMessage({ chatId, message: assistantMessage }))
    dispatch(setGenerating(true))

    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const contextMessages = settings.system_prompt.trim()
        ? [
            {
              id: createId(),
              role: 'system' as const,
              content: settings.system_prompt.trim(),
              createdAt: now - 1,
            },
            ...activeChat.messages,
            userMessage,
          ]
        : [...activeChat.messages, userMessage]
      const shouldUseMultimodalModel = hasImagesInContext(contextMessages)

      await streamChatCompletion({
        messages: contextMessages,
        settings: resolveSettingsForRequest(settings, shouldUseMultimodalModel),
        signal: controller.signal,
        onChunk: (chunk: string) => {
          dispatch(appendAssistantChunk({ chatId, messageId: assistantId, chunk }))
        },
      })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        const message = error instanceof Error ? error.message : 'Failed to fetch completion'
        dispatch(setError(message))
      }
    } finally {
      dispatch(finishAssistantMessage({ chatId, messageId: assistantId }))
      dispatch(setGenerating(false))
      controllerRef.current = null
    }
  }

  return {
    isGenerating,
    sendMessage,
    stopGeneration,
  }
}
