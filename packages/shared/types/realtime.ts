export type ExchangeRequestMessage = {
  type: 'exchange'
  requestId: string
  sessionId: string
  messageText: string
  characterId: string
}

export type ExchangeResultMessage = {
  type: 'exchange_result'
  requestId: string
  data: unknown
}

export type ExchangeErrorMessage = {
  type: 'exchange_error'
  requestId: string
  error: string
}

export type RelayControlMessage =
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'ready'; transport: 'websocket' }
  | { type: 'auth'; bearerToken: string }
  | { type: 'auth_ok' }

export type RelayMessage =
  | ExchangeRequestMessage
  | ExchangeResultMessage
  | ExchangeErrorMessage
  | RelayControlMessage
