# Logging Service

This document defines logging rules for `generic-draft-abstract`. It is written for implementation agents and must be read before adding request, API, DB, baker, audit, or admin-log functionality.

## Values

- **Application code is not log storage code.** Feature code emits structured events. It must not know how the log service stores, batches, rotates, or cleans them.
- **Logs are useful, not exhaustive.** Log events that explain behavior, failures, security decisions, slow paths, and administrative actions. Do not log every internal step.
- **Safety first.** Never log secrets, request bodies, cookies, session ids, passwords, password hashes, invite codes, or raw authorization headers.
- **Best effort delivery.** Logging must never break a user request. If log delivery fails, the application continues.
- **Replaceable transport and storage.** The default transport is a local Unix socket. The log service may write to SQLite now and another backend later without changing feature code.
- **Admin visibility is read-only from the application side.** The application may read the log database to display logs in admin UI. It must not write log rows directly.

## Architecture

Use a separate log service process.

```text
application process
  -> LogClient / Logger interface
  -> Unix socket JSONL transport
  -> log service
  -> logs database

admin UI in application process
  -> read-only log queries
  -> logs database
```

The application owns event creation. The log service owns:

- event validation;
- field trimming and final redaction;
- batching;
- database writes;
- retention and cleanup;
- storage-specific schema.

## Default Transport

Default communication is **Unix domain socket + JSON Lines**.

Recommended production socket:

```text
/run/generic-draft-abstract/log.sock
```

Development uses:

```text
./data/log.sock
```

One line is one JSON event:

```json
{"v":1,"level":"info","kind":"request","message":"GET /","requestId":"req_...","ts":"2026-05-12T10:00:00.000Z","meta":{"route":"/","status":302,"durationMs":4}}
```

Rules:

- Append `\n` after every event.
- Event payload must be JSON-serializable.
- The application must not wait indefinitely for socket writes.
- If the socket is unavailable, the client buffers within a bounded queue and reconnects.
- If the queue is full, drop low-value events first: `debug`, then `info`.
- Even `warn`, `error`, and `audit` must not block user requests forever.

Optional fallback transport is local TCP on `127.0.0.1`. Do not expose a log ingest port publicly.

Avoid HTTP as the default transport. It is easier to debug but adds unnecessary request parsing and response semantics for local one-way logging.

Do not use UDP for audit or security logs.

## Module Boundaries

Application-side modules:

```text
src/lib/logging/types.ts
src/lib/logging/logger.ts
src/lib/logging/context.ts
src/lib/logging/socket-client.ts
```

Log-service-side modules:

```text
src/log-service.ts
src/log-service/protocol.ts
src/log-service/sqlite-store.ts
src/log-service/retention.ts
```

Import rules:

- Handlers, bakers, DB helpers, and server runtime may import `src/lib/logging/*`.
- Application feature code must not import `src/log-service/*`.
- Application feature code must not import the log SQLite store.
- Log service code may import protocol/store helpers, but must not import application handlers/pages/parts.
- Browser code under `src/parts/*/*.js` must not import logging modules.

## Application Logger Interface

Feature code should use a narrow logger API:

```ts
logger.info('request', 'GET /', meta);
logger.warn('auth', 'admin forbidden', meta);
logger.error('api', 'admin.user.role.set failed', meta);
logger.audit('admin.user.role.set', meta);
```

The logger converts calls into a structured event:

```ts
interface LogEvent {
  v: 1;
  ts: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  kind: 'request' | 'api' | 'db' | 'baker' | 'auth' | 'audit' | 'system';
  message: string;
  requestId?: string;
  userId?: number;
  role?: 'user' | 'admin';
  meta: Record<string, unknown>;
}
```

`audit(...)` is a convenience call that emits `kind: 'audit'` and `level: 'info'` unless the action failed.

## Request Context

Each request gets a `requestId`. The request context should carry:

- `requestId`;
- method;
- matched route pattern;
- sanitized path;
- current user id and role, once known;
- start time.

The router should expose or record the matched route pattern so logs say `/admin` or `/api/admin/user/role`, not arbitrary raw paths.

Auth helpers may attach user id and role to request context after successful session lookup. They must not attach session id.

## What To Log

### Page Requests

Log one request summary:

- method;
- route;
- sanitized path;
- status;
- durationMs;
- requestId;
- userId/role if known;
- error class/message for 5xx.

Do not log query strings by default. If a query value is needed, add a safe allowlisted meta field.

### API Requests

Log request summary and important action result.

For mutations, add an audit event:

```ts
logger.audit('admin.user.role.set', {
  targetUserId,
  result: 'ok',
});
```

Do not log request body or response body. Add only safe allowlisted metadata.

### DB Operations

Do not log every SQL statement by default.

Use existing named operation wrappers when they add diagnostic value:

```ts
logDbOperation('auth.listUsers', () => stmtListUsers.all());
```

Default DB logging:

- log errors;
- log slow operations over a configured threshold;
- optionally log rows/changes count when safe;
- do not log raw SQL or params by default.
- do not add wrappers mechanically around every query.

### Bakers

Use existing named baker wrappers for server-rendered page state when duration or failure visibility is useful:

```ts
logBaker('admin-page', () => bakeAdminPage(ctx));
```

Log:

- baker name;
- durationMs;
- safe counts or summary values;
- thrown errors.

Do not log full baked state.

### Auth And Security

Log:

- failed login result without password;
- rate limit events;
- forbidden admin access;
- CSRF failures;
- self-demotion rejection.

Do not log invite codes, passwords, password hashes, cookies, or session ids.

## Storage And Admin UI

Default log storage is separate from the application database:

```text
data/logs.db
```

Feature and application code must not write log rows directly and must not depend on log storage details. The log service is the writer.

The application may read the log database for admin UI only through a narrow read-only adapter. That adapter is the only application-side code allowed to know the current log storage shape. If storage changes from SQLite to another backend, update the admin log reader/adapter and log service storage code; feature logging calls must not change.

Admin log UI should be separate from user management:

```text
GET /admin/logs
GET /api/admin/logs
```

The current admin log UI may remain a simple admin-only table of latest log rows. Add filters only when investigation workflows need them. Useful future filters include:

- date range;
- level;
- kind;
- route;
- status;
- userId;
- requestId;
- text search in message;
- limit/page.

The admin UI must not expose secret-bearing metadata. The log service should prevent secrets from being stored; the UI should still render defensively.

## Retention

The log service owns retention.

Default policy:

- keep logs for 30 days;
- optionally enforce max row count;
- cleanup on service startup and periodically while running.

Retention must not run in the web application process.

## Failure Rules

Logging failures must not fail application behavior.

Application-side behavior:

- socket unavailable: queue and reconnect;
- queue full: drop low-value events;
- malformed event construction: emit a local `console.warn` and continue;
- transport errors: local `console.warn` with rate limiting.

Log-service behavior:

- malformed JSON line: reject/drop that event and count it;
- invalid schema: reject/drop that event and count it;
- database unavailable: keep bounded internal queue if possible, otherwise drop and write to stderr;
- retention failure: write to stderr, do not stop ingest.

## Environment

Suggested production env:

```env
LOG_SOCKET_PATH=/run/generic-draft-abstract/log.sock
LOG_DB_PATH=/root/generic-draft-abstract/data/logs.db
LOG_RETENTION_DAYS=30
LOG_SLOW_DB_MS=100
LOG_QUEUE_LIMIT=1000
```

Suggested development env:

```env
LOG_SOCKET_PATH=./data/log.sock
LOG_DB_PATH=./data/logs.dev.db
LOG_RETENTION_DAYS=7
LOG_SLOW_DB_MS=50
LOG_QUEUE_LIMIT=500
```

## Agent Checklist For New Features

When adding a feature:

1. Identify important events: request, API mutation, DB operation, baker, audit, security.
2. Use existing logger helpers. Do not create ad hoc `console.log` instrumentation.
3. Do not import log-service modules into application code.
4. Do not write directly to the log database from application code.
5. Do not log bodies, cookies, session ids, passwords, invite codes, auth headers, or raw SQL params.
6. Add safe allowlisted metadata only.
7. For DB work, use named operation logging for slow/error paths when it adds real diagnostic value.
8. For admin/security mutations, add an audit event.
9. Keep logging best-effort; user behavior must not depend on log delivery.
10. Update this document if adding a new log kind, transport, or storage behavior.

## Implementation Notes

The current project already has the default logging system: application logger helpers, Unix socket JSONL transport, a separate log service, SQLite storage, request logging, basic audit logging, DB/baker helper wrappers, setup/systemd support, and a simple `/admin/logs` page.

If rebuilding this subsystem from scratch or replacing a major piece, use this order:

1. Define types and logger interface.
2. Add Unix socket client with bounded queue.
3. Add log service with JSONL parser and SQLite writer.
4. Add request context and HTTP request summary logging.
5. Add audit logging for existing admin role mutation.
6. Add DB/baker helper wrappers.
7. Add `/admin/logs` page and API.
8. Add setup/systemd docs for the log service.
9. Add tests and smoke checks for redaction and delivery failure.

## Current Implementation

- `node --run dev` starts the log service as a child process and then starts the app server.
- `node --run logs` starts only the log service.
- Production `setup.sh` creates `generic-draft-abstract-log-service.service` and `generic-draft-abstract-server.service`.
- `/admin/logs` renders the latest log rows in a simple admin-only table.
