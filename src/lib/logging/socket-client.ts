import { createConnection, type Socket } from 'node:net';
import type { LogEvent } from './types.ts';

const DEFAULT_QUEUE_LIMIT = 1000;
const RECONNECT_MS = 1000;

function queueLimit(): number {
  const value = Number.parseInt(process.env.LOG_QUEUE_LIMIT ?? '', 10);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_QUEUE_LIMIT;
}

function socketPath(): string {
  return process.env.LOG_SOCKET_PATH || './data/log.sock';
}

export class SocketLogClient {
  private socket?: Socket;
  private connected = false;
  private connecting = false;
  private reconnectTimer: unknown;
  private queue: string[] = [];
  private warned = false;
  private flushing = false;

  write(event: LogEvent): void {
    const line = `${JSON.stringify(event)}\n`;
    this.enqueue(line, event.level);
    if (this.connected) this.flush();
    else this.connect();
  }

  close(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.destroy();
  }

  private enqueue(line: string, level: string): void {
    const limit = queueLimit();
    if (this.queue.length >= limit) {
      const lowValueIndex = this.queue.findIndex((item) =>
        item.includes('"level":"debug"') || item.includes('"level":"info"'),
      );
      if (lowValueIndex >= 0) this.queue.splice(lowValueIndex, 1);
      else if (level === 'debug' || level === 'info') return;
      else this.queue.shift();
    }
    this.queue.push(line);
  }

  private connect(): void {
    if (this.connected || this.connecting) return;
    this.connecting = true;

    const socket = createConnection(socketPath(), () => {
      this.connected = true;
      this.connecting = false;
      this.warned = false;
      this.flush();
    });

    socket.on('error', (err) => {
      this.connected = false;
      this.connecting = false;
      this.flushing = false;
      this.warn(err);
      socket.destroy();
      this.scheduleReconnect();
    });

    socket.on('close', () => {
      this.connected = false;
      this.connecting = false;
      this.flushing = false;
      this.socket = undefined;
      if (this.queue.length) this.scheduleReconnect();
    });

    socket.on('drain', () => this.flush());
    this.socket = socket;
  }

  private flush(): void {
    if (!this.socket || !this.connected || this.flushing || !this.queue.length) return;
    this.flushing = true;
    const line = this.queue[0] as string;
    this.socket.write(line, (err) => {
      this.flushing = false;
      if (err) {
        this.warn(err);
        this.socket?.destroy();
        return;
      }
      if (this.queue[0] === line) this.queue.shift();
      else {
        const index = this.queue.indexOf(line);
        if (index >= 0) this.queue.splice(index, 1);
      }
      this.flush();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, RECONNECT_MS);
  }

  private warn(err: unknown): void {
    if (this.warned) return;
    this.warned = true;
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`log delivery failed: ${message}`);
  }
}
