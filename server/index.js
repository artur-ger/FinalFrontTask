import express from 'express'
import dotenv from 'dotenv'
import crypto from 'node:crypto'

dotenv.config()

const app = express()

app.use(express.json({ limit: '20mb' }))

const PORT = Number(process.env.PORT ?? 43123)
const GIGACHAT_AUTH_URL = process.env.GIGACHAT_AUTH_URL ?? 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const GIGACHAT_API_URL = process.env.GIGACHAT_API_URL ?? 'https://gigachat.devices.sberbank.ru/api/v1'
const GIGACHAT_SCOPE = process.env.GIGACHAT_SCOPE ?? 'GIGACHAT_API_PERS'
const GIGACHAT_CLIENT_ID = process.env.GIGACHAT_CLIENT_ID ?? ''
const GIGACHAT_CLIENT_SECRET = process.env.GIGACHAT_CLIENT_SECRET ?? ''
const GIGACHAT_AUTHORIZATION_KEY = process.env.GIGACHAT_AUTHORIZATION_KEY ?? ''
const TOKEN_REFRESH_INTERVAL_MS = 30 * 60 * 1000

if (process.env.GIGACHAT_ALLOW_UNSAFE_TLS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

const hasClientCredentials = Boolean(GIGACHAT_CLIENT_ID && GIGACHAT_CLIENT_SECRET)
const hasAuthorizationKey = Boolean(GIGACHAT_AUTHORIZATION_KEY)

if (!hasClientCredentials && !hasAuthorizationKey) {
  console.warn(
    'Missing OAuth credentials. Set GIGACHAT_AUTHORIZATION_KEY or both GIGACHAT_CLIENT_ID and GIGACHAT_CLIENT_SECRET.',
  )
}

const tokenCache = {
  accessToken: null,
  expiresAtMs: 0,
}
let refreshInFlight = null

const getBasicAuth = () => {
  if (hasAuthorizationKey) {
    const normalized = GIGACHAT_AUTHORIZATION_KEY.trim().replace(/^"+|"+$/g, '')
    return normalized.startsWith('Basic ') ? normalized : `Basic ${normalized}`
  }

  const encoded = Buffer.from(`${GIGACHAT_CLIENT_ID}:${GIGACHAT_CLIENT_SECRET}`).toString('base64')
  return `Basic ${encoded}`
}

const readErrorCode = (error) => {
  if (!error || typeof error !== 'object') {
    return ''
  }
  const direct = typeof error.code === 'string' ? error.code : ''
  if (direct) {
    return direct
  }
  const cause = error.cause
  return cause && typeof cause === 'object' && typeof cause.code === 'string' ? cause.code : ''
}

const isTlsChainError = (error) => {
  const code = readErrorCode(error)
  return (
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
  )
}

const fetchWithTlsPolicy = async (url, init) => {
  try {
    return await fetch(url, init)
  } catch (error) {
    if (isTlsChainError(error)) {
      throw new Error(
        'TLS certificate chain validation failed for GigaChat endpoints. Set GIGACHAT_ALLOW_UNSAFE_TLS=true for local debugging or configure trusted certificates.',
      )
    }
    throw error
  }
}

const requestToken = async () => {
  const response = await fetchWithTlsPolicy(GIGACHAT_AUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: getBasicAuth(),
      RqUID: crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      scope: GIGACHAT_SCOPE,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(errorText || `OAuth failed with status ${response.status}`)
  }

  const data = await response.json()
  const expiresAt = Number(data.expires_at ?? 0)
  const expiresIn = Number(data.expires_in ?? 0)
  const fallbackExpiry = Date.now() + Math.max(60, expiresIn) * 1000

  tokenCache.accessToken = data.access_token
  tokenCache.expiresAtMs = expiresAt > 0 ? expiresAt - 30_000 : fallbackExpiry - 30_000

  return tokenCache.accessToken
}

const getValidToken = async ({ force = false } = {}) => {
  if (!force && tokenCache.accessToken && Date.now() < tokenCache.expiresAtMs) {
    return tokenCache.accessToken
  }

  if (!refreshInFlight) {
    refreshInFlight = requestToken().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

const buildUpstreamUrl = (path) => `${GIGACHAT_API_URL}${path}`

const forwardHeaders = (token, accept = 'application/json') => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Accept: accept,
})

const uploadHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
})

const imageMimeToExt = (mimeType) => {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/tiff':
      return 'tiff'
    case 'image/bmp':
      return 'bmp'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

const parseDataUrl = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const match = value.match(/^data:([^;,]+);base64,(.+)$/)
  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    base64: match[2],
  }
}

const extractTextAndImageUrls = (content) => {
  if (!Array.isArray(content)) {
    return { text: '', imageUrls: [] }
  }

  const textParts = []
  const imageUrls = []

  for (const part of content) {
    if (!part || typeof part !== 'object') {
      continue
    }
    if (part.type === 'text' && typeof part.text === 'string') {
      textParts.push(part.text)
      continue
    }
    if (part.type === 'image_url') {
      if (typeof part.image_url === 'string') {
        imageUrls.push(part.image_url)
        continue
      }
      if (part.image_url && typeof part.image_url === 'object' && typeof part.image_url.url === 'string') {
        imageUrls.push(part.image_url.url)
      }
    }
  }

  return {
    text: textParts.join('\n').trim(),
    imageUrls,
  }
}

const uploadImageFromDataUrl = async (dataUrl, token) => {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) {
    throw new Error('Unsupported image format in request. Expected base64 data URL.')
  }

  const ext = imageMimeToExt(parsed.mimeType)
  const fileName = `upload-${Date.now()}.${ext}`
  const bytes = Buffer.from(parsed.base64, 'base64')
  const blob = new Blob([bytes], { type: parsed.mimeType })

  const formData = new FormData()
  formData.append('file', blob, fileName)
  formData.append('purpose', 'general')

  const uploadResponse = await fetchWithTlsPolicy(buildUpstreamUrl('/files'), {
    method: 'POST',
    headers: uploadHeaders(token),
    body: formData,
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => '')
    throw new Error(errorText || `File upload failed with status ${uploadResponse.status}`)
  }

  const file = await uploadResponse.json()
  if (!file?.id) {
    throw new Error('File upload succeeded but response does not contain file id.')
  }

  return file.id
}

const normalizeMessagesForGigachat = async (messages, token) => {
  if (!Array.isArray(messages)) {
    return messages
  }

  const normalized = []

  for (const message of messages) {
    if (!message || typeof message !== 'object' || !Array.isArray(message.content)) {
      normalized.push(message)
      continue
    }

    const { text, imageUrls } = extractTextAndImageUrls(message.content)
    const nextMessage = {
      ...message,
      content: text,
    }

    if (message.role === 'user' && imageUrls.length > 0) {
      // GigaChat expects image ids in `attachments` after upload to /files.
      // One image per message is supported by API constraints.
      const imageId = await uploadImageFromDataUrl(imageUrls[0], token)
      nextMessage.attachments = [imageId]
    }

    normalized.push(nextMessage)
  }

  return normalized
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    message: 'Proxy server is running',
  })
})

app.get('/api/v1/models', async (_req, res) => {
  try {
    const token = await getValidToken()
    const upstream = await fetchWithTlsPolicy(buildUpstreamUrl('/models'), {
      method: 'GET',
      headers: forwardHeaders(token),
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
    res.send(text)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch models',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.post('/api/v1/chat/completions', async (req, res) => {
  try {
    const token = await getValidToken()
    const payload = req.body && typeof req.body === 'object' ? structuredClone(req.body) : {}
    payload.messages = await normalizeMessagesForGigachat(payload.messages, token)
    const wantsStreaming = Boolean(req.body?.stream)
    const acceptHeader = wantsStreaming ? 'text/event-stream, application/json' : 'application/json'

    const upstream = await fetchWithTlsPolicy(buildUpstreamUrl('/chat/completions'), {
      method: 'POST',
      headers: forwardHeaders(token, acceptHeader),
      body: JSON.stringify(payload),
    })

    if (!upstream.ok) {
      const upstreamText = await upstream.text().catch(() => '')
      res.status(upstream.status)
      res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
      res.send(upstreamText)
      return
    }

    if (wantsStreaming && (upstream.headers.get('content-type') ?? '').includes('text/event-stream')) {
      res.status(upstream.status)
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')

      if (!upstream.body) {
        res.end()
        return
      }

      const reader = upstream.body.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        res.write(Buffer.from(value))
      }

      res.end()
      return
    }

    const bodyText = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
    res.send(bodyText)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to complete chat request',
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

app.listen(PORT, () => {
  console.log(`GigaChat proxy server started on http://localhost:${PORT}`)
})

if (hasClientCredentials || hasAuthorizationKey) {
  void getValidToken({ force: true }).catch((error) => {
    console.warn('Initial token warm-up failed:', error instanceof Error ? error.message : String(error))
  })

  setInterval(() => {
    void getValidToken({ force: true }).catch((error) => {
      console.warn('Scheduled token refresh failed:', error instanceof Error ? error.message : String(error))
    })
  }, TOKEN_REFRESH_INTERVAL_MS)
}
