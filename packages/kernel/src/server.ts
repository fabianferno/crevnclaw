import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'node:events';

export interface ServerConfig {
  port: number;
  jwtSecret: string;
  originAllowlist: string[];
}

export class GatewayServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    super();
    this.config = config;
  }

  generateToken(payload: Record<string, unknown> = {}): string {
    return jwt.sign({ ...payload, iss: 'crevnclaw' }, this.config.jwtSecret, {
      expiresIn: '24h' as jwt.SignOptions['expiresIn'],
    });
  }

  validateToken(token: string): jwt.JwtPayload {
    return jwt.verify(token, this.config.jwtSecret) as jwt.JwtPayload;
  }

  start(server?: Server): void {
    this.wss = new WebSocketServer({
      ...(server ? { server } : { port: this.config.port }),
      verifyClient: (info, callback) => {
        try {
          this.verifyClient(info.req);
          callback(true);
        } catch (err: any) {
          callback(false, 401, err.message || 'Unauthorized');
        }
      },
    });

    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);
      this.emit('connection', ws, req);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.emit('message', message, ws);
        } catch {
          ws.send(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        this.emit('disconnect', ws);
      });

      ws.on('error', (err) => {
        this.emit('client-error', err, ws);
      });
    });

    this.wss.on('error', (err) => {
      this.emit('error', err);
    });
  }

  private verifyClient(req: IncomingMessage): void {
    // Check origin
    const origin = req.headers.origin;
    if (origin && this.config.originAllowlist.length > 0) {
      if (!this.config.originAllowlist.includes(origin)) {
        throw new Error(`Origin ${origin} not allowed`);
      }
    }

    // Check Authorization header
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }

    const token = auth.slice(7);
    try {
      this.validateToken(token);
    } catch {
      throw new Error('Invalid token');
    }
  }

  broadcast(data: unknown): void {
    const payload = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  async shutdown(): Promise<void> {
    for (const client of this.clients) {
      client.close(1001, 'Server shutting down');
    }
    this.clients.clear();

    return new Promise<void>((resolve, reject) => {
      if (!this.wss) {
        resolve();
        return;
      }
      this.wss.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      this.wss = null;
    });
  }
}
