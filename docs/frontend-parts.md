# Frontend Parts

This document defines how browser UI is built in `generic-draft-abstract`.

## Values

The frontend engine is a small skeleton, not a framework.

- **No magic:** every effect follows from an explicit operation.
- **Explicit state flow:** DOM changes happen from state handlers, not scattered event callbacks.
- **Small runtime:** no virtual DOM, no automatic dependency tracking, no hidden scheduler.
- **Stated limits:** prefer bounded pages, explicit pagination, and simple repeated UI over infinite live surfaces.
- **Developer-owned lifecycle:** global listeners, timers, abort controllers, and child instances are cleaned up explicitly.

## Architecture

Pages are composed from reusable **parts**. The server returns an HTML shell with baked JSON and mount scripts. Browser templates create the page body.

Current generic parts:

- `home-page` — protected empty home page.
- `auth-page` — login/register form.
- `admin-page` — user role management.
- `nav-controls` — admin link, language switch, logout.
- `back-top` — scroll-to-top button.

## Part Layout

A part lives under `src/parts/<name>/`:

```text
src/parts/<name>/
  index.js       # browser facade: imports template.js and handlers.js only
  template.js    # default export: (state, part) => string
  handlers.js    # default export: { events, state, onMount, onDestroy }
  baker.ts       # optional server-only state producer
```

`index.js` must keep this shape:

```js
import * as templates from './template.js';
import handlers from './handlers.js';

export default {
  template: templates.default,
  templates,
  handlers,
};
```

Browser modules must not import `baker.ts`. Bakers may use DB/server APIs and belong to `src/pages/*`, not to `/engine/core.js`.

## State Model

Each mounted part instance has private **microState**. Initial state is resolved by stable instance id:

1. `baked[params.id]`
2. `params.microState`
3. `{}`

Baked JSON is flat:

```json
{
  "home-page": { "title": "Home" },
  "nav-controls": { "isAdmin": false }
}
```

Handlers receive a `part` object with:

- `part.id`
- `part.state`
- `part.refs`
- `part.root`
- `part.private`
- `part.templates`
- `part.set`

Do not depend on engine-internal fields.

## State Mutation

Use `part.set` for changes that should notify handlers:

```js
part.set('saving', true);
part.set({ items: nextItems, saving: false });
```

For each changed key, the engine:

1. compares by `===`;
2. writes changed values;
3. publishes exposed MacroState fields;
4. calls matching `handlers.state[key]`.

Batched updates write all changed values before handlers run. For collections, replace references:

```js
part.set('items', [...part.state.items, nextItem]);
```

Direct `part.state.x = value` is allowed only for deliberate silent state that should not notify handlers.

## Handlers And DOM

Event handlers should move data into state. DOM writes belong in `handlers.state[*]`.

```js
export default {
  events: {
    'click [data-action="save"]': (part) => {
      part.set('saving', true);
    },
  },
  state: {
    saving: (part, value) => {
      part.refs.saveButton.disabled = value;
    },
  },
};
```

Rules:

- Use delegated event keys: `'click [data-action="..."]'`.
- Use `data-ref` for nodes handlers need.
- Inline event attributes such as `onclick` are forbidden.
- Direct DOM in `onMount`/`onDestroy` is only for imperative global listeners, timers, fetch abort cleanup, and similar lifecycle work.
- Anything created in `onMount` must be cleaned up in `onDestroy`.

## Templates

Templates return HTML strings and must produce exactly one root element.

- Escape all user/external text with `escape` from `/engine/core.js`.
- Keep repeated sub-templates as named exports/functions.
- Put action hooks in `data-action`.
- Put stable DOM references in `data-ref`.

## Collection Updates

Use full collection fields for replacement and region re-render:

```js
part.set('items', nextItems);
```

Use patch-trigger fields only for real deltas:

```js
part.set('patchItemStatusUpdates', [{ id, status }]);
```

Patch-trigger handlers must first fold the delta into the backing collection in `part.state`, then update only affected DOM nodes. Do not use microState or MacroState as an event bus.

If a one-shot event field is unavoidable, prefix it with `event`, for example `eventScrollTop`.

## MacroState

MacroState is a page-wide push-only coordination bus for selected top-level fields.

- Exposed paths are `{id}.{field}`.
- One owner per path.
- `subscribe` maps local state field names to remote paths.
- Mirror fields must not be written with `part.set`.
- MacroState is for coordination flags, modes, and small cross-part signals.
- Do not use MacroState for bulk data, caches, or general shared storage.

When a page wires `expose` or `subscribe`, keep a short `MacroState contract` JSDoc next to the mount composition.

## Adding A UI Feature

1. Decide whether the feature belongs in an existing part or needs a new part. Prefer extending existing parts when ownership is clear.
2. Define the state contract first: fields, collection shape, patch fields, labels, loading/error flags.
3. Put server-loaded initial state in the part baker.
4. Add/extend the page renderer to bake flat JSON and mount the part.
5. Write templates as pure HTML string functions.
6. Route events through `part.set`.
7. Implement DOM changes in `handlers.state[*]`.
8. Add lifecycle cleanup for global listeners/timers.
9. Run `node --run check` and `node --run lint`.

## Deliberate Omissions

The engine does not provide virtual DOM, automatic read tracking, deep equality, list virtualization, automatic cascade cleanup, dynamic subscriptions, global instance reads, or declarative global event syntax. Add these only after a concrete need and a documented design decision.
