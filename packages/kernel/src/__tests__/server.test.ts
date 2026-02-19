import { describe, it, expect, afterEach } from 'vitest';
import { GatewayServer } from '../server.js';
import { WebSocket } from 'ws';
import http from 'node:http';

const JWT_SECRET = 'test-secret-key-for-testing';
const PORT = 9871;

function createServer(port = PORT): GatewayServer {
  return new GatewayServer({
    port,
    jwtSecret: JWT_SECRET,
    originAllowlist: ['http://localhost:3000'],
  });
}

function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('GatewayServer', () => {
  let server: GatewayServer;

  afterEach(async () => {
    if (server) {
      await server.shutdown();
    }
  });

  it('generates and validates JWT tokens', () => {
    server = createServer();
    const token = server.generateToken({ userId: 'test-user' });

    expect(typeof token).toBe('string');

    const decoded = server.validateToken(token);
    expect(decoded.userId).toBe('test-user');
    expect(decoded.iss).toBe('crevnclaw');
  });

  it('rejects invalid tokens', () => {
    server = createServer();
    expect(() => server.validateToken('invalid-token')).toThrow();
  });

  it('rejects connections without Authorization header', async () => {
    server = createServer();
    server.start();
    await waitFor(100);

    const ws = new WebSocket(`ws://localhost:${PORT}`, {
      headers: { origin: 'http://localhost:3000' },
    });

    const error = await new Promise<Error>((resolve) => {
      ws.on('error', resolve);
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('401');
  });

  it('accepts connections with valid token', async () => {
    server = createServer();
    server.start();
    await waitFor(100);

    const token = server.generateToken();
    const ws = new WebSocket(`ws://localhost:${PORT}`, {
      headers: {
        authorization: `Bearer ${token}`,
        origin: 'http://localhost:3000',
      },
    });

    const opened = await new Promise<boolean>((resolve) => {
      ws.on('open', () => resolve(true));
      ws.on('error', () => resolve(false));
    });

    expect(opened).toBe(true);
    expect(server.getClientCount()).toBe(1);

    ws.close();
    await waitFor(50);
  });

  it('rejects connections from disallowed origins', async () => {
    server = createServer();
    server.start();
    await waitFor(100);

    const token = server.generateToken();
    const ws = new WebSocket(`ws://localhost:${PORT}`, {
      headers: {
        authorization: `Bearer ${token}`,
        origin: 'http://evil.com',
      },
    });

    const error = await new Promise<Error>((resolve) => {
      ws.on('error', resolve);
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('401');
  });

  it('broadcasts messages to all connected clients', async () => {
    server = createServer();
    server.start();
    await waitFor(100);

    const token = server.generateToken();

    const ws1 = new WebSocket(`ws://localhost:${PORT}`, {
      headers: {
        authorization: `Bearer ${token}`,
        origin: 'http://localhost:3000',
      },
    });

    const ws2 = new WebSocket(`ws://localhost:${PORT}`, {
      headers: {
        authorization: `Bearer ${token}`,
        origin: 'http://localhost:3000',
      },
    });

    await Promise.all([
      new Promise<void>(resolve => ws1.on('open', resolve)),
      new Promise<void>(resolve => ws2.on('open', resolve)),
    ]);

    expect(server.getClientCount()).toBe(2);

    const messages: string[] = [];
    ws1.on('message', (data) => messages.push(data.toString()));
    ws2.on('message', (data) => messages.push(data.toString()));

    server.broadcast({ type: 'test', data: 'hello' });
    await waitFor(50);

    expect(messages).toHaveLength(2);
    expect(JSON.parse(messages[0])).toEqual({ type: 'test', data: 'hello' });
    expect(JSON.parse(messages[1])).toEqual({ type: 'test', data: 'hello' });

    ws1.close();
    ws2.close();
    await waitFor(50);
  });

  it('tracks client count on connect and disconnect', async () => {
    server = createServer();
    server.start();
    await waitFor(100);

    expect(server.getClientCount()).toBe(0);

    const token = server.generateToken();
    const ws = new WebSocket(`ws://localhost:${PORT}`, {
      headers: {
        authorization: `Bearer ${token}`,
        origin: 'http://localhost:3000',
      },
    });

    await new Promise<void>(resolve => ws.on('open', resolve));
    expect(server.getClientCount()).toBe(1);

    ws.close();
    await waitFor(100);
    expect(server.getClientCount()).toBe(0);
  });

  it('clean shutdown closes all connections', async () => {
    server = createServer();
    server.start();
    await waitFor(100);

    const token = server.generateToken();
    const ws = new WebSocket(`ws://localhost:${PORT}`, {
      headers: {
        authorization: `Bearer ${token}`,
        origin: 'http://localhost:3000',
      },
    });

    await new Promise<void>(resolve => ws.on('open', resolve));
    expect(server.getClientCount()).toBe(1);

    await server.shutdown();

    // After shutdown, client count should be 0
    expect(server.getClientCount()).toBe(0);
  });
});
