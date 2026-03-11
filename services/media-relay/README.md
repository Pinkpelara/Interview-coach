# Seatvio Media Relay (WebSocket-first)

This service provides a WebSocket transport for interview turn exchange.

It forwards `exchange` messages to the existing API endpoint:

- `POST /api/sessions/:id/exchange`

and sends the response back over the socket.

## Protocol

Client -> Relay:

```json
{ "type": "exchange", "requestId": "abc", "sessionId": "sess_1", "messageText": "answer", "characterId": "char_1" }
```

Relay -> Client success:

```json
{ "type": "exchange_result", "requestId": "abc", "data": { "...": "same shape as /exchange API" } }
```

Relay -> Client error:

```json
{ "type": "exchange_error", "requestId": "abc", "error": "message" }
```

Optional auth bootstrap:

```json
{ "type": "auth", "bearerToken": "..." }
```

The relay also forwards the original WebSocket `Cookie` header to the API call, so same-domain session-cookie auth works.

## Local run

```bash
cd services/media-relay
npm install
cp .env.example .env
npm run dev
```

Then configure the frontend with:

```bash
NEXT_PUBLIC_INTERVIEW_WS_URL=ws://localhost:8787/ws/interview
```
