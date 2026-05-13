# Dependency Policy

This project keeps the production runtime dependency surface small.

## Values

- **Operational simplicity:** fewer runtime packages means fewer update, security, and deploy concerns.
- **Auditability:** small local code is often easier to inspect than a convenience dependency.
- **Platform first:** prefer Node.js, browser, SQLite, nginx, and systemd capabilities already present.
- **Explicit justification:** adding a dependency is a design decision, not a reflex.

## Runtime Model

`generic-draft-abstract` should not have application-level npm runtime dependencies by default.

Current runtime stack:

- Node.js 24 and built-ins.
- Native browser ES modules and DOM APIs.
- SQLite through Node's `node:sqlite`.
- nginx for production static delivery and reverse proxy.
- systemd for process management.

`package.json` is a command manifest and module-mode marker. It is not a runtime dependency manifest for the VPS service.

## Development Tools

Development tools are allowed when they stay outside production behavior:

- TypeScript for `node --run check`.
- Biome for `node --run lint` and `node --run format`.

The local `node --run dev` command uses project source and Node built-ins. Do not add a dev server package unless there is a concrete documented reason.

## Adding A Dependency

Before adding any package, answer:

1. What concrete problem does it solve?
2. Can Node.js 24 built-ins solve it?
3. Can browser APIs solve it?
4. Can existing project code solve it with a small extension?
5. Is it better handled by SQLite, nginx, systemd, or deployment tooling?
6. Is it runtime or development-only?
7. How does it affect deploy, upgrades, security review, and failure modes?

If still necessary, document:

- why built-ins/local code are insufficient;
- where the dependency is used;
- whether it is runtime or development-only;
- how it is installed and updated;
- what operational risks it introduces.

Default answer for convenience libraries is no.

## Deployment Implication

A minimal deploy copies source, runtime configuration, and persistent runtime data. It should not require `node_modules/` unless the project explicitly adopts a package-based runtime model.

Persistent `.env` and `data/` must remain independent from application source updates.
