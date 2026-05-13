export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogKind = 'request' | 'api' | 'db' | 'baker' | 'auth' | 'audit' | 'system';
export type UserRole = 'user' | 'admin';

export interface LogEvent {
  v: 1;
  ts: string;
  level: LogLevel;
  kind: LogKind;
  message: string;
  requestId?: string;
  userId?: number;
  role?: UserRole;
  meta: Record<string, unknown>;
}

export interface LogInput {
  requestId?: string;
  userId?: number;
  role?: UserRole;
  meta?: Record<string, unknown>;
}

export interface RequestLogContext {
  requestId: string;
  method: string;
  path: string;
  route: string;
  startMs: number;
  userId?: number;
  role?: UserRole;
}
