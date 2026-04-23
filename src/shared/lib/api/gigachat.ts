import type { ChatSettings, Message } from '../../types/chat'

interface StreamRequestPayload {
  messages: Message[]
  settings: ChatSettings
  signal: AbortSignal
  onChunk: (chunk: string) => void
}

interface GigaChoice {
  delta?: { content?: string }
  message?: { content?: string }
  finish_reason?: string | null
}

interface GigaChunk {
  choices?: GigaChoice[]
}

const API_URL = '/api/v1/chat/completions'

const USE_MOCK_FALLBACK = import.meta.env.VITE_USE_MOCK_FALLBACK === 'true'

type ApiContent = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>

interface ApiMessage {
  role: Message['role']
  content: ApiContent
}

const toApiMessages = (messages: Message[]): ApiMessage[] =>
  messages.map((message) => {
    if (message.role === 'user' && message.images && message.images.length > 0) {
      return {
        role: message.role,
        content: [
          { type: 'text', text: message.content },
          ...message.images.map((image) => ({
            type: 'image_url' as const,
            image_url: { url: image },
          })),
        ],
      }
    }

    return {
      role: message.role,
      content: message.content,
    }
  })

const extractContent = (chunk: GigaChunk): string => {
  const choice = chunk.choices?.[0]
  return choice?.delta?.content ?? choice?.message?.content ?? ''
}

const parseSseData = (rawData: string): GigaChunk | null => {
  const payload = rawData.trim()
  if (!payload || payload === '[DONE]') {
    return null
  }
  try {
    return JSON.parse(payload) as GigaChunk
  } catch {
    return null
  }
}

const flushEventBlock = (block: string, onChunk: (chunk: string) => void): void => {
  const lines = block.split('\n')
  const dataLines = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, ''))

  if (dataLines.length === 0) {
    return
  }

  const parsed = parseSseData(dataLines.join('\n'))
  if (!parsed) {
    return
  }

  const text = extractContent(parsed)
  if (text) {
    onChunk(text)
  }
}

const streamFromSse = async (
  response: Response,
  onChunk: (chunk: string) => void,
): Promise<void> => {
  if (!response.body) {
    throw new Error('Streaming response has no body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const eventBlock of events) {
      flushEventBlock(eventBlock, onChunk)
    }
  }

  if (buffer.trim()) {
    flushEventBlock(buffer, onChunk)
  }
}

const simulateLocalReply = async (
  messages: Message[],
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
): Promise<void> => {
  const lastUser = [...messages].reverse().find((msg) => msg.role === 'user')
  const text =
    lastUser?.content?.trim() || 'No user message detected. Please send a prompt to continue the demo mode.'
  const mock = `Demo mode response. Backend API is not connected yet.\n\nYou said: ${text}`
  const chunks = mock.match(/.{1,16}/g) ?? [mock]

  for (const chunk of chunks) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    onChunk(chunk)
    await new Promise((resolve) => window.setTimeout(resolve, 40))
  }
}

export const streamChatCompletion = async ({
  messages,
  settings,
  signal,
  onChunk,
}: StreamRequestPayload): Promise<void> => {
  const payload = {
    model: settings.model,
    messages: toApiMessages(messages),
    temperature: settings.temperature,
    top_p: settings.top_p,
    max_tokens: settings.max_tokens,
    repetition_penalty: settings.repetition_penalty,
    stream: true,
  }

  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
      },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (error) {
    if (USE_MOCK_FALLBACK) {
      await simulateLocalReply(messages, signal, onChunk)
      return
    }
    throw error
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('text/event-stream')) {
    await streamFromSse(response, onChunk)
    return
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content ?? ''
  if (text) {
    onChunk(text)
  }
}
