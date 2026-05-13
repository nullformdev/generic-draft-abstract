import { bakeAdminPage } from '../parts/admin-page/baker.ts';
import { logBaker } from '../lib/logging/logger.ts';
import { mountScript, renderPartPage } from './part-page.ts';

interface AdminRenderContext {
  lang: string;
  currentUserId: number;
  isAdmin: boolean;
}

export function renderAdminPage(ctx: AdminRenderContext): string {
  const page = logBaker('admin-page', () => bakeAdminPage({
    lang: ctx.lang,
    currentUserId: ctx.currentUserId,
  }));

  return renderPartPage({
    lang: ctx.lang,
    title: page.title,
    isAdmin: ctx.isAdmin,
    baked: { [page.id]: page.state },
    body: mountScript('/parts/admin-page/index.js', page.id),
  });
}
