export interface WSMessage {
  type: string;
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export function createWSConnection(url: string, token: string) {
  const ws = new WebSocket(`${url}?token=${token}`);
  return {
    ws,
    onMessage(handler: (msg: WSMessage) => void) {
      ws.addEventListener('message', (e) => {
        try {
          handler(JSON.parse(e.data));
        } catch {
          // Ignore malformed messages
        }
      });
    },
    send(msg: WSMessage) {
      ws.send(JSON.stringify(msg));
    },
    close() {
      ws.close();
    },
  };
}
