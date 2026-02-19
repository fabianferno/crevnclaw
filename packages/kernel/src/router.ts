import { EventEmitter } from 'node:events';
import { WSMessageSchema, type WSMessage, type WSMessageType } from '@crevnclaw/types';

export class MessageRouter extends EventEmitter {
  route(raw: unknown): void {
    const parsed = WSMessageSchema.safeParse(raw);
    if (!parsed.success) {
      this.emit('error', new Error(`Invalid message: ${parsed.error.message}`));
      return;
    }

    const message: WSMessage = parsed.data;
    this.emit(message.type, message);
    this.emit('*', message);
  }

  onType(type: WSMessageType, handler: (message: WSMessage) => void): void {
    this.on(type, handler);
  }

  offType(type: WSMessageType, handler: (message: WSMessage) => void): void {
    this.off(type, handler);
  }
}
