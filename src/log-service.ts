/**
 * log-service.ts — local log ingest service.
 */

import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname } from 'node:path';
import { parseLogLine } from './log-service/protocol.ts';
import { LogStore } from './log-service/sqlite-store.ts';

const socketPath = process.env.LOG_SOCKET_PATH || './data/log.sock';
const store = new LogStore();

function maxLineBytes(): number {
  const value = Number.parseInt(process.env.LOG_MAX_LINE_BYTES ?? '', 10);
  return Number.isInteger(value) && value > 0 ? value : 64 * 1024;
}

mkdirSync(dirname(socketPath), { recursive: true });
if (existsSync(socketPath)) unlinkSync(socketPath);

store.retention();
setInterval(() => {
  try {
    store.retention();
  } catch (err) {
    console.error('log retention failed:', err);
  }
}, 60 * 60 * 1000);

const server = createServer((socket) => {
  socket.setEncoding('utf8');
  let buffer = '';

  socket.on('data', (chunk) => {
    buffer += String(chunk);
    const maxLine = maxLineBytes();
    if (buffer.length > maxLine && !buffer.includes('\n')) {
      console.warn('oversized log line dropped');
      buffer = '';
      socket.destroy();
      return;
    }

    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        if (line.length > maxLine) {
          console.warn('oversized log line dropped');
        } else {
          const event = parseLogLine(line);
          if (event) {
            try {
              store.write(event);
            } catch (err) {
              console.error('log write failed:', err);
            }
          }
        }
      }
      newline = buffer.indexOf('\n');
    }
  });
});

server.on('error', (err) => {
  console.error('log service error:', err);
  process.exit(1);
});

server.listen(socketPath, () => {
  console.log(`log service listening on ${socketPath}`);
});

function shutdown(): void {
  server.close(() => {
    if (existsSync(socketPath)) unlinkSync(socketPath);
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
