import { escape as htmlEscape } from '../../engine/core.js';

export default function template(state) {
  const adminControls = state.showSessionControls && state.isAdmin
    ? `<details class="nav-dropdown" data-ref="dropdown">
        <summary data-ref="summary" aria-expanded="false">
          ${htmlEscape(state.controlsLabel)}
        </summary>
        <div class="nav-dropdown-panel">
          <a href="/admin" class="nav-dropdown-link">${htmlEscape(state.manageLabel)}</a>
          <a href="/admin/logs" class="nav-dropdown-link">${htmlEscape(state.logsLabel)}</a>
        </div>
      </details>`
    : '';
  const logoutControl = state.showSessionControls
    ? `<form method="post" action="/logout">
      <button type="submit">${htmlEscape(state.logoutLabel)}</button>
    </form>`
    : '';

  return `<div class="nav-controls" data-ref="root">
    ${adminControls}
    <a href="${htmlEscape(state.langHref)}" class="nav-lang">
      ${htmlEscape(state.langLabel)}
    </a>
    ${logoutControl}
  </div>`;
}
