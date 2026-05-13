import { renderUsers, table, usersHead } from './template.js';

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'error');
  return data;
}

function renderUsersSection(part) {
  part.refs.users.innerHTML = table(
    part.state.sections.users,
    usersHead(part.state.cols),
    renderUsers(part.state),
    'admin-users',
  );
}

export default {
  events: {
    'change [data-action="admin-user-role"]': async (part, event) => {
      const input = event.target.closest('[data-action="admin-user-role"]');
      const userId = Number(input.dataset.userId);
      const role = input.checked ? 'admin' : 'user';
      const previousRole = input.checked ? 'user' : 'admin';
      part.set({
        pendingUserRoleId: userId,
        users: part.state.users.map((user) => (user.id === userId ? { ...user, role } : user)),
      });
      try {
        await postJson('/api/admin/user/role', { userId, role });
      } catch (err) {
        part.set({
          users: part.state.users.map((user) =>
            user.id === userId ? { ...user, role: previousRole } : user,
          ),
          errorMessage: err.message || part.state.actions.error,
        });
      } finally {
        part.set('pendingUserRoleId', 0);
      }
    },
  },
  state: {
    users: renderUsersSection,
    pendingUserRoleId: renderUsersSection,
    errorMessage: (_part, value) => {
      if (value) alert(value);
    },
  },
};
