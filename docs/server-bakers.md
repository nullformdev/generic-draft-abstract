# Server Bakers And Page Renderers

This document defines how server-side page state is produced and passed into browser parts.

## Values

- **HTTP stays at the boundary:** request parsing, auth, redirects, status codes, and response type belong in handlers.
- **State loading is colocated with parts:** a part baker builds the state contract consumed by that part.
- **Pages compose, they do not improvise:** page renderers assemble shell, baked JSON, and mount scripts.
- **Authorization is not decorative:** handlers guard access before renderers and bakers run.
- **State is serializable:** baked data must be plain JSON-compatible values.

## Layers

The application server has three page layers:

1. **Handlers** in `src/handlers/*`
   - Own `req`/`res`.
   - Require session/admin role.
   - Parse params, forms, and JSON bodies.
   - Choose redirects, status codes, and response type.
   - Call one page renderer for HTML pages.

2. **Page renderers** in `src/pages/*`
   - Call part bakers.
   - Assemble flat baked JSON.
   - Place mount scripts.
   - Return an HTML shell or a typed absence result.

3. **Part bakers** in `src/parts/*/baker.ts`
   - Load DB/API/server data.
   - Build the serializable state contract for one part.
   - May import server-only modules.

Handlers should not manually load page data for HTML pages. Page renderers and bakers receive already-authorized context and must not become the security boundary.

## Handler Shape

```ts
export function handleHome(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  html(res, renderHomePage({
    lang: session.data.lang,
    isAdmin: session.role === 'admin',
  }));
}
```

Do not split a handler into ad hoc `load + bake + render` work. If data is for HTML page state, it belongs in a baker.

## Baker Contract

A baker returns enough information for a page renderer to mount a browser part:

```ts
export function bakeHomePage(lang: string) {
  const title = t(lang, 'home.title');

  return {
    id: 'home-page',
    title,
    state: {
      title,
    },
  };
}
```

For pages that can be absent, use a small result union:

```ts
{ ok: true, id, title, state }
{ ok: false, message }
```

The page renderer maps this to HTML or absence; the handler maps absence to `404`, redirect, or another HTTP response.

## Page Renderer Responsibilities

A page renderer:

1. Calls relevant bakers.
2. Assembles baked JSON as `{ [stableInstanceId]: state }`.
3. Generates the HTML shell with:
   - `/engine/core.js`;
   - `<script type="application/json" id="__BAKED__">`;
   - one mount script per instance.
4. Keeps any page-level `MacroState contract` comment current.
5. Returns HTML or a typed absence result.

The page renderer must not emit server-rendered page bodies when a browser part owns that body. It emits shell, state, and mount instructions.

## Baked JSON

Baked JSON is flat by stable instance id:

```json
{
  "home-page": { "title": "Home" },
  "nav-controls": { "isAdmin": false },
  "back-top": { "visible": false }
}
```

The browser engine resolves initial state as:

```js
const state = baked[params.id] ?? params.microState ?? {};
```

The client engine never imports or calls bakers.

## Query Batching

If multiple instances need related data, batch with plain server code:

- A baker may issue one query and split data into state fields.
- A page renderer may call several bakers and combine their states.
- The client engine must not grow a special server-baker batching mechanism.

## Errors

- Baker throws: bubble to renderer/handler; the application chooses the response.
- Baker returns `{ ok: false }`: renderer returns absence or fallback; handler maps to HTTP.
- Missing baked slice for a mounted page root is an authoring/server bug, even if client fallback masks it.

## Adding A Server-Backed Feature

1. Add or extend the durable model in `src/lib/*` and `src/lib/db.ts`.
2. Add server helpers that expose narrow operations, not raw SQL scattered across handlers.
3. Add/extend a part baker to produce the UI state contract.
4. Add/extend a page renderer to include the baked slice and mount script.
5. Add a handler route only for HTTP concerns.
6. Add JSON APIs for mutations; guard them with `requireSessionApi` or `requireAdminApi`.
7. Validate input at the handler/API boundary.
8. Keep client hiding separate from backend authorization.
9. Run `node --run check` and `node --run lint`.

## Current Pages

- `/` -> `handleHome` -> `renderHomePage` -> `bakeHomePage` -> `home-page`.
- `/login`, `/register` -> auth handlers -> auth page renderer -> `auth-page`.
- `/admin` -> `requireAdmin` -> `renderAdminPage` -> `bakeAdminPage` -> `admin-page`.
