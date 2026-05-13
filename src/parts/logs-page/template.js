import { escape as htmlEscape } from '../../engine/core.js';

function rows(logs, state) {
  return logs.length
    ? logs
        .map(
          (log) => `<tr>
            <td>${htmlEscape(log.createdAt)}</td>
            <td>${htmlEscape(log.level)}</td>
            <td>${htmlEscape(log.kind)}</td>
            <td>${htmlEscape(log.route)}</td>
            <td>${log.status ?? ''}</td>
            <td>${log.userId ?? ''}</td>
            <td>${htmlEscape(log.requestId)}</td>
            <td>${htmlEscape(log.message)}</td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="8">${htmlEscape(state.empty)}</td></tr>`;
}

export default function template(state) {
  return `<section class="logs-page">
    <div class="topbar">
      <span class="topbar-label">${htmlEscape(state.title)}</span>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-table logs-table">
        <thead>
          <tr>
            <th>${htmlEscape(state.cols.time)}</th>
            <th>${htmlEscape(state.cols.level)}</th>
            <th>${htmlEscape(state.cols.kind)}</th>
            <th>${htmlEscape(state.cols.route)}</th>
            <th>${htmlEscape(state.cols.status)}</th>
            <th>${htmlEscape(state.cols.userId)}</th>
            <th>${htmlEscape(state.cols.requestId)}</th>
            <th>${htmlEscape(state.cols.message)}</th>
          </tr>
        </thead>
        <tbody data-ref="rows">${rows(state.logs, state)}</tbody>
      </table>
    </div>
  </section>`;
}
