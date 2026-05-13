import { listUsers } from '../../lib/auth/auth.ts';
import { t } from '../../pages/lang.ts';

interface AdminBakeContext {
  lang: string;
  currentUserId: number;
}

export function bakeAdminPage(ctx: AdminBakeContext): {
  id: string;
  title: string;
  state: Record<string, unknown>;
} {
  const { lang } = ctx;
  const title = t(lang, 'admin.title');

  return {
    id: 'admin-page',
    title,
    state: {
      title,
      users: listUsers(),
      currentUserId: ctx.currentUserId,
      pendingUserRoleId: 0,
      errorMessage: '',
      empty: t(lang, 'admin.empty'),
      sections: {
        users: t(lang, 'admin.users'),
      },
      cols: {
        id: t(lang, 'admin.col.id'),
        login: t(lang, 'admin.col.login'),
        admin: t(lang, 'admin.col.admin'),
        createdAt: t(lang, 'admin.col.created_at'),
      },
      actions: {
        saving: t(lang, 'admin.action.saving'),
        error: t(lang, 'admin.error.action_failed'),
      },
    },
  };
}
