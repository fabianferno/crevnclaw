import { describe, it, expect, afterEach } from 'vitest';
import { GatewayServer } from '../server.js';
import { Scheduler, Lane } from '../scheduler.js';
import { MessageRouter } from '../router.js';
import { WebSocket } from 'ws';

const JWT_SECRET = 'integration-test-secret';
const PORT = 9877;

function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Integration', () => {
  let server: GatewayServer;

  afterEach(async () => {
    await server?.shutdown();
  });

  it('full message flow: connect, send, receive broadcast', async () => {
    server = new GatewayServer({
      port: PORT,
      jwtSecret: JWT_SECRET,
      originAllowlist: [],
    });
    const scheduler = new Scheduler();
    const router = new MessageRouter();

    server.start();
    await waitFor(100);

    const token = server.generateToken();

    // Connect client
    const ws = new WebSocket(`ws://localhost:${PORT}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await new Promise<void>(resolve => ws.on('open', resolve));

    // Setup router to echo messages back via broadcast
    server.on('message', (msg) => {
      router.route(msg);
    });
    router.on('chat', (msg) => {
      scheduler.enqueue(Lane.Interactive, async () => {
        server.broadcast({
          type: 'chat',
          id: 'response-1',
          timestamp: new Date().toISOString(),
          payload: { text: 'echo: ' + (msg.payload as any).text },
        });
      });
      scheduler.flush();
    });

    // Send message
    const responsePromise = new Promise<any>(resolve => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    ws.send(JSON.stringify({
      type: 'chat',
      id: 'msg-1',
      timestamp: new Date().toISOString(),
      payload: { text: 'hello' },
    }));

    const response = await responsePromise;
    expect(response.type).toBe('chat');
    expect(response.payload.text).toBe('echo: hello');

    ws.close();
  });
});
