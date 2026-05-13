/**
 * dev-server.ts — local development entry point.
 *
 * Starts the normal application server with built-in development static asset
 * serving for /static, /engine, and /parts. Use package.json's dev script so
 * Node loads .env.dev before this module runs.
 */

import { mkdirSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';

process.env.DEV_SERVER = '1';

mkdirSync('data', { recursive: true });

const logService: ChildProcess = spawn('node', ['--env-file=.env.dev', 'src/log-service.ts'], {
  stdio: 'inherit',
});

function stopLogService(): void {
  logService.kill('SIGTERM');
}

process.on('exit', stopLogService);
process.on('SIGINT', () => {
  stopLogService();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stopLogService();
  process.exit(143);
});

await import('./server.ts');
