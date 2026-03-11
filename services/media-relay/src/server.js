import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT || 8787)
const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/$/, '')
const WS_PATH = process.env.WS_PATH || '/ws/interview'

if (!API_BASE_URL) {
  // eslint-disable-next-line no-console
  console.warn('[media-relay] API_BASE_URL is not set. Requests will fail until configured.')
}

const server = createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

const wss = new WebSocketServer({ noServer: true })

function parsePathAndQuery(urlString = '') {
  const [pathname, query = ''] = urlString.split('?')
  const params = new URLSearchParams(query)
  return { pathname, params }
}

function sendJson(ws, payload) {
  if (ws.readyState !== ws.OPEN) return
  ws.send(JSON.stringify(payload))
}

async function handleExchange(ws, message) {
  const requestId = message.requestId || randomUUID()
  const sessionId = String(message.sessionId || ws._sessionId || '').trim()
  const messageText = String(message.messageText || '').trim()
  const characterId = String(message.characterId || '').trim()

  if (!sessionId || !messageText || !characterId) {
    sendJson(ws, {
      type: 'exchange_error',
      requestId,
      error: 'sessionId, messageText, and characterId are required',
    })
    return
  }

  if (!API_BASE_URL) {
    sendJson(ws, {
      type: 'exchange_error',
      requestId,
      error: 'media relay API_BASE_URL is not configured',
    })
    return
  }

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (ws._cookie) headers.Cookie = ws._cookie
    if (ws._bearerToken) headers.Authorization = `Bearer ${ws._bearerToken}`

    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/exchange`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messageText, characterId }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      sendJson(ws, {
        type: 'exchange_error',
        requestId,
        error: data.error || 'Exchange request failed',
      })
      return
    }

    sendJson(ws, {
      type: 'exchange_result',
      requestId,
      data,
    })
  } catch (error) {
    sendJson(ws, {
      type: 'exchange_error',
      requestId,
      error: error instanceof Error ? error.message : 'Unexpected relay error',
    })
  }
}

wss.on('connection', (ws, req) => {
  const { params } = parsePathAndQuery(req.url || '')
  const sessionId = params.get('sessionId')
  const cookie = req.headers.cookie || ''

  ws._id = randomUUID()
  ws._cookie = cookie
  ws._sessionId = sessionId || null
  ws._bearerToken = null

  sendJson(ws, { type: 'ready', transport: 'websocket' })

  ws.on('message', async (raw) => {
    let message = null
    try {
      message = JSON.parse(raw.toString())
    } catch {
      sendJson(ws, { type: 'error', error: 'Invalid JSON payload' })
      return
    }

    if (message.type === 'ping') {
      sendJson(ws, { type: 'pong' })
      return
    }

    if (message.type === 'auth') {
      const token = typeof message.bearerToken === 'string' ? message.bearerToken.trim() : ''
      ws._bearerToken = token || null
      sendJson(ws, { type: 'auth_ok' })
      return
    }

    if (message.type === 'exchange') {
      await handleExchange(ws, message)
      return
    }

    sendJson(ws, { type: 'error', error: `Unsupported message type: ${message.type}` })
  })
})

server.on('upgrade', (req, socket, head) => {
  const { pathname } = parsePathAndQuery(req.url || '')
  if (pathname !== WS_PATH) {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[media-relay] listening on :${PORT}, ws path: ${WS_PATH}`)
})
