'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ExchangePayload = {
  messageText: string
  characterId: string
}

export type ExchangeResult = {
  candidateExchange: {
    id: string
    sequenceNumber: number
    speaker: 'candidate'
    characterId: null
    messageText: string
    timestampMs: number
  }
  interviewerExchange: {
    id: string
    sequenceNumber: number
    speaker: 'interviewer'
    characterId: string
    messageText: string
    timestampMs: number
  }
  character: {
    id: string
    name: string
    title: string
    archetype: string
    avatarKey?: string
  }
}

type PendingRequest = {
  resolve: (value: ExchangeResult) => void
  reject: (reason?: unknown) => void
  timeout: ReturnType<typeof setTimeout>
}

type WsResponse =
  | { type: 'exchange_result'; requestId: string; data: ExchangeResult }
  | { type: 'exchange_error'; requestId: string; error: string }
  | { type: 'pong' }

export type InterviewTransportStatus = 'http' | 'connecting' | 'websocket'

export function useInterviewExchangeTransport(
  sessionId: string,
  httpExchange: (payload: ExchangePayload) => Promise<ExchangeResult>
) {
  const wsUrl = process.env.NEXT_PUBLIC_INTERVIEW_WS_URL
  const [status, setStatus] = useState<InterviewTransportStatus>(wsUrl ? 'connecting' : 'http')
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map())
  const reconnectAttemptsRef = useRef(0)
  const aliveRef = useRef(true)

  const clearPending = useCallback((message: string) => {
    pendingRef.current.forEach((pending) => {
      clearTimeout(pending.timeout)
      pending.reject(new Error(message))
    })
    pendingRef.current.clear()
  }, [])

  const connect = useCallback(() => {
    if (!wsUrl || !aliveRef.current) {
      setStatus('http')
      return
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return

    setStatus('connecting')

    const separator = wsUrl.includes('?') ? '&' : '?'
    const url = `${wsUrl}${separator}sessionId=${encodeURIComponent(sessionId)}`
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0
      setStatus('websocket')
    }

    socket.onmessage = (event) => {
      let payload: WsResponse
      try {
        payload = JSON.parse(event.data) as WsResponse
      } catch {
        return
      }

      if (payload.type === 'exchange_result') {
        const pending = pendingRef.current.get(payload.requestId)
        if (!pending) return
        clearTimeout(pending.timeout)
        pending.resolve(payload.data)
        pendingRef.current.delete(payload.requestId)
        return
      }

      if (payload.type === 'exchange_error') {
        const pending = pendingRef.current.get(payload.requestId)
        if (!pending) return
        clearTimeout(pending.timeout)
        pending.reject(new Error(payload.error || 'WebSocket exchange failed'))
        pendingRef.current.delete(payload.requestId)
      }
    }

    socket.onerror = () => {
      // onclose handles fallback and reconnect.
    }

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null
      }
      setStatus('http')
      clearPending('WebSocket connection closed')
      if (!aliveRef.current || !wsUrl) return
      const delay = Math.min(10_000, 1200 * Math.max(1, reconnectAttemptsRef.current))
      reconnectAttemptsRef.current += 1
      reconnectTimerRef.current = setTimeout(() => connect(), delay)
    }
  }, [clearPending, sessionId, wsUrl])

  useEffect(() => {
    aliveRef.current = true
    if (wsUrl) {
      connect()
    } else {
      setStatus('http')
    }

    return () => {
      aliveRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      clearPending('Component unmounted')
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [clearPending, connect, wsUrl])

  const sendExchange = useCallback(async (payload: ExchangePayload): Promise<ExchangeResult> => {
    const socket = socketRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      try {
        const result = await new Promise<ExchangeResult>((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingRef.current.delete(requestId)
            reject(new Error('WebSocket timeout'))
          }, 9000)

          pendingRef.current.set(requestId, { resolve, reject, timeout })
          socket.send(
            JSON.stringify({
              type: 'exchange',
              requestId,
              sessionId,
              messageText: payload.messageText,
              characterId: payload.characterId,
            })
          )
        })
        return result
      } catch {
        // Fallback to HTTP when WS roundtrip fails.
      }
    }
    return httpExchange(payload)
  }, [httpExchange, sessionId])

  return { sendExchange, transportStatus: status }
}
