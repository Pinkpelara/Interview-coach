# Seatvio Media Relay (Unified v4)

WebSocket relay between browser clients and interview-conductor.

## Paths

- Primary v4 path: `/ws/audio/:session_id`
- Legacy compatibility path: `/ws/interview?sessionId=:id`
- Health: `/healthz`

## Behavior

- Opens upstream WebSocket to conductor: `CONDUCTOR_WS_BASE/:session_id`
- Forwards binary and JSON frames both directions
- Supports legacy `exchange` message contract for older frontend transport

## Local run

```bash
cd services/media-relay
npm install
npm run dev
```
