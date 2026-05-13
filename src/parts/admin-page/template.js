import { escape as htmlEscape } from '../../engine/core.js';

function rows(items, render, empty, colspan) {
  return items.length
    ? items.map(render).join('')
    : `<tr><td colspan="${colspan}">${htmlEscape(empty)}</td></tr>`;
}

export function table(title, head, body, sectionId) {
  return `<section id="${sectionId}" class="admin-section">
    <h2>${htmlEscape(title)}</h2>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </section>`;
}

export function usersHead(s) {
  return `<tr>
    <th>${htmlEscape(s.id)}</th>
    <th>${htmlEscape(s.login)}</th>
    <th>${htmlEscape(s.admin)}</th>
    <th>${htmlEscape(s.createdAt)}</th>
  </tr>`;
}

function userRow(user, state) {
  const isSelf = user.id === state.currentUserId;
  const isPending = user.id === state.pendingUserRoleId;
  const disabled = isSelf || isPending;

  return `<tr data-user-id="${user.id}">
    <td>${user.id}</td>
    <td>${htmlEscape(user.login)}</td>
    <td>
      <input
        type="checkbox"
        data-action="admin-user-role"
        data-user-id="${user.id}"
        ${user.role === 'admin' ? 'checked' : ''}
        ${disabled ? 'disabled' : ''}
      >
    </td>
    <td>${htmlEscape(user.createdAt)}</td>
  </tr>`;
}

export function renderUsers(state) {
  return rows(state.users, (user) => userRow(user, state), state.empty, 4);
}

export default function template(state) {
  return `<section class="admin-page">
    <div class="topbar">
      <span class="topbar-label">${htmlEscape(state.title)}</span>
    </div>
    <div data-ref="users">
      ${table(state.sections.users, usersHead(state.cols), renderUsers(state), 'admin-users')}
    </div>
  </section>`;
}
