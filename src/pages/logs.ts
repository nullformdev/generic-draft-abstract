import { logBaker } from '../lib/logging/logger.ts';
import { bakeLogsPage } from '../parts/logs-page/baker.ts';
import { mountScript, renderPartPage } from './part-page.ts';

interface LogsRenderContext {
  lang: string;
  isAdmin: boolean;
}

export function renderLogsPage(ctx: LogsRenderContext): string {
  const page = logBaker('logs-page', () => bakeLogsPage(ctx.lang));

  return renderPartPage({
    lang: ctx.lang,
    title: page.title,
    isAdmin: ctx.isAdmin,
    baked: { [page.id]: page.state },
    body: mountScript('/parts/logs-page/index.js', page.id),
  });
}
