import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const WS_BASE_PATH = process.env.WS_PATH || "/ws/audio";
const CONDUCTOR_WS_BASE = (process.env.CONDUCTOR_WS_BASE || "ws://localhost:8091/ws/interview").replace(/\/$/, "");
const API_BASE_URL = (process.env.API_BASE_URL || "").replace(/\/$/, "");

const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "seatvio-media-relay" }));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const wss = new WebSocketServer({ noServer: true });

function parsePath(urlString = "") {
  const [pathname] = urlString.split("?");
  return pathname || "";
}

function parseSessionId(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const baseParts = WS_BASE_PATH.split("/").filter(Boolean);
  if (parts.length !== baseParts.length + 1) return null;
  for (let i = 0; i < baseParts.length; i += 1) {
    if (parts[i] !== baseParts[i]) return null;
  }
  return parts[parts.length - 1];
}

function parseLegacySessionId(urlString = "") {
  const [_pathname, query = ""] = urlString.split("?");
  const params = new URLSearchParams(query);
  const value = params.get("sessionId");
  return value && value.trim().length > 0 ? value.trim() : null;
}

function sendJson(ws, payload) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

wss.on("connection", (clientWs, req, sessionId) => {
  const relayId = randomUUID();
  const conductorUrl = `${CONDUCTOR_WS_BASE}/${encodeURIComponent(sessionId)}`;
  const conductorWs = new WebSocket(conductorUrl);

  sendJson(clientWs, { type: "relay_ready", relay_id: relayId, session_id: sessionId });

  conductorWs.on("open", () => {
    sendJson(clientWs, { type: "relay_connected", upstream: "interview-conductor" });
  });

  conductorWs.on("message", (data, isBinary) => {
    if (clientWs.readyState !== WebSocket.OPEN) return;
    if (isBinary) clientWs.send(data, { binary: true });
    else clientWs.send(data.toString());
  });

  conductorWs.on("close", () => {
    sendJson(clientWs, { type: "relay_upstream_closed" });
  });

  conductorWs.on("error", (error) => {
    sendJson(clientWs, { type: "relay_upstream_error", error: error.message });
  });

  clientWs.on("message", async (raw, isBinary) => {
    if (!isBinary) {
      let payload = null;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        // Pass through non-JSON text to conductor if connected.
      }
      if (payload?.type === "exchange") {
        if (!API_BASE_URL) {
          sendJson(clientWs, { type: "exchange_error", requestId: payload.requestId, error: "API_BASE_URL is not configured" });
          return;
        }
        try {
          const response = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            body: JSON.stringify({
              messageText: payload.messageText,
              characterId: payload.characterId,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            sendJson(clientWs, {
              type: "exchange_error",
              requestId: payload.requestId,
              error: data.error || "Exchange relay failed",
            });
            return;
          }
          sendJson(clientWs, { type: "exchange_result", requestId: payload.requestId, data });
          return;
        } catch (error) {
          sendJson(clientWs, {
            type: "exchange_error",
            requestId: payload.requestId,
            error: error instanceof Error ? error.message : "Relay failure",
          });
          return;
        }
      }
    }

    if (conductorWs.readyState !== WebSocket.OPEN) return;
    if (isBinary) {
      conductorWs.send(raw, { binary: true });
      return;
    }
    conductorWs.send(raw.toString());
  });

  clientWs.on("close", () => {
    if (conductorWs.readyState === WebSocket.OPEN || conductorWs.readyState === WebSocket.CONNECTING) {
      conductorWs.close();
    }
  });
});

server.on("upgrade", (req, socket, head) => {
  const pathname = parsePath(req.url || "");
  const sessionId = parseSessionId(pathname) || (pathname === "/ws/interview" ? parseLegacySessionId(req.url || "") : null);
  if (!sessionId) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req, sessionId));
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[media-relay] listening on :${PORT}, ws base path: ${WS_BASE_PATH}/:session_id`);
});
