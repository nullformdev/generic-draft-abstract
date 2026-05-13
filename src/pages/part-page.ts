/**
 * part-page.ts — server-side assembly for pages rendered by client parts.
 */

import { t } from './lang.ts';

function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function mountScript(
  partPath: string,
  id: string,
  params: Record<string, unknown> = {},
): string {
  return `
  <script mount-dot="mount-dot-${id}" type="module">
    import partModule from '${partPath}';
    import { mount } from '/engine/core.js';
    mount(partModule, ${safeJson({ id, microState: {}, ...params })});
  </script>`;
}

function navState(lang: string, isAdmin: boolean, showSessionControls: boolean): Record<string, unknown> {
  return {
    isAdmin,
    showSessionControls,
    controlsLabel: t(lang, 'nav.controls'),
    manageLabel: t(lang, 'nav.manage'),
    logsLabel: t(lang, 'nav.logs'),
    dropdownOpen: false,
    langHref: `/lang/${lang === 'ru' ? 'en' : 'ru'}`,
    langLabel: lang === 'ru' ? 'EN' : 'RU',
    logoutLabel: t(lang, 'nav.logout'),
  };
}

interface PartPageOptions {
  lang: string;
  title: string;
  baked: Record<string, unknown>;
  body: string;
  isAdmin: boolean;
  showSessionControls?: boolean;
}

export function renderPartPage(opts: PartPageOptions): string {
  const title = escapeHtml(opts.title);
  const lang = escapeHtml(opts.lang);
  const baked = {
    ...opts.baked,
    'nav-controls': navState(opts.lang, opts.isAdmin, opts.showSessionControls ?? true),
    'back-top': { visible: false, eventScrollTop: 0 },
  };
  const navControls = mountScript('/parts/nav-controls/index.js', 'nav-controls');
  const backTop = mountScript('/parts/back-top/index.js', 'back-top');

  return `<!DOCTYPE html>
  <html lang="${lang}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title}</title>
      <link rel="stylesheet" href="/static/css/style.css">
      <link rel="icon" type="image/png" href="/static/favicon.png">
      <script type="module" src="/engine/core.js"></script>
      <script type="application/json" id="__BAKED__">${safeJson(baked)}</script>
    </head>
    <body>
      <nav class="nav">
        <div class="nav-inner">
          <a class="nav-logo" href="/">generic-draft-abstract</a>
          <div class="nav-links">
            ${navControls}
          </div>
        </div>
      </nav>
      <main class="main">
        ${opts.body}
      </main>
      ${backTop}
    </body>
  </html>`;
}
